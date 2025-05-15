
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface ConversationMetricsProps {
  messages: Array<{role: string, content: string, timestamp: Date}>
  agentResponseTime?: number;
  userResponseTime?: number;
}

export function ConversationMetrics({ 
  messages, 
  agentResponseTime = 0,
  userResponseTime = 0
}: ConversationMetricsProps) {
  const [turnCount, setTurnCount] = useState(0);
  const [avgMessageLength, setAvgMessageLength] = useState({ agent: 0, user: 0 });
  const [sentimentScore, setSentimentScore] = useState(50); // Default neutral
  
  // Calculate simple metrics from messages
  useEffect(() => {
    // Count conversation turns
    const turns = messages.reduce((count, msg, i, arr) => {
      if (i > 0 && msg.role !== arr[i-1].role) {
        return count + 1;
      }
      return count;
    }, 0);
    
    // Calculate average message lengths
    const agentMessages = messages.filter(m => m.role === 'assistant');
    const userMessages = messages.filter(m => m.role === 'user');
    
    const agentAvgLength = agentMessages.length > 0
      ? Math.round(agentMessages.reduce((sum, m) => sum + m.content.length, 0) / agentMessages.length)
      : 0;
      
    const userAvgLength = userMessages.length > 0
      ? Math.round(userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length)
      : 0;
      
    setTurnCount(turns);
    setAvgMessageLength({
      agent: agentAvgLength,
      user: userAvgLength
    });
    
    // Extremely simple sentiment analysis based on keywords
    // In a real application, you would use proper NLP techniques
    if (messages.length > 0) {
      // Look for positive words in user messages
      const userContent = userMessages.map(m => m.content.toLowerCase()).join(" ");
      const positiveWords = ['good', 'great', 'excellent', 'thanks', 'thank you', 'helpful', 'appreciate', 'yes', 'perfect'];
      const negativeWords = ['bad', 'wrong', 'not helpful', 'confused', 'confusing', 'no', 'don\'t', 'cannot', 'error', 'issue'];
      
      let positiveCount = 0;
      let negativeCount = 0;
      
      positiveWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = userContent.match(regex);
        if (matches) positiveCount += matches.length;
      });
      
      negativeWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = userContent.match(regex);
        if (matches) negativeCount += matches.length;
      });
      
      // Calculate a score from 0-100
      if (positiveCount === 0 && negativeCount === 0) {
        setSentimentScore(50); // Neutral
      } else {
        const total = positiveCount + negativeCount;
        const score = Math.round((positiveCount / total) * 100);
        setSentimentScore(score);
      }
    }
  }, [messages]);
  
  // Calculate conversation timing metrics
  const timingMetrics = useMemo(() => {
    if (messages.length < 2) {
      return { 
        totalDuration: 0,
        avgTurnTime: 0
      };
    }
    
    // Calculate total conversation duration
    const firstMessageTime = messages[0].timestamp.getTime();
    const lastMessageTime = messages[messages.length - 1].timestamp.getTime();
    const totalDuration = Math.round((lastMessageTime - firstMessageTime) / 1000);
    
    // Calculate average time between turns
    let totalTurnTime = 0;
    let turnCount = 0;
    
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].role !== messages[i-1].role) {
        const timeBetween = messages[i].timestamp.getTime() - messages[i-1].timestamp.getTime();
        totalTurnTime += timeBetween;
        turnCount++;
      }
    }
    
    const avgTurnTime = turnCount > 0 ? Math.round(totalTurnTime / turnCount / 1000) : 0;
    
    return {
      totalDuration,
      avgTurnTime
    };
  }, [messages]);
  
  // Get sentiment color
  const getSentimentColor = (score: number) => {
    if (score < 30) return "bg-red-500";
    if (score < 50) return "bg-yellow-500";
    if (score < 70) return "bg-blue-500";
    return "bg-green-500";
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conversation Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Messages</Label>
              <span className="text-sm font-medium">{messages.length}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Turn Count</Label>
              <span className="text-sm font-medium">{turnCount}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Duration</Label>
              <span className="text-sm font-medium">{timingMetrics.totalDuration}s</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Avg Turn Time</Label>
              <span className="text-sm font-medium">{timingMetrics.avgTurnTime}s</span>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm flex items-center">
              User Sentiment
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Estimated sentiment based on word usage. Higher scores indicate more positive sentiment.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-sm font-medium">{sentimentScore}/100</span>
          </div>
          <Progress 
            value={sentimentScore} 
            className={`h-2 ${getSentimentColor(sentimentScore)}`} 
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">User Msg Length</Label>
              <span className="text-sm font-medium">{avgMessageLength.user} chars</span>
            </div>
            <Progress 
              value={Math.min(avgMessageLength.user / 2, 100)} 
              className="h-2" 
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Agent Msg Length</Label>
              <span className="text-sm font-medium">{avgMessageLength.agent} chars</span>
            </div>
            <Progress 
              value={Math.min(avgMessageLength.agent / 2, 100)} 
              className="h-2" 
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Agent Response</Label>
              <span className="text-sm font-medium">{agentResponseTime}ms</span>
            </div>
            <Progress 
              value={Math.min(100 - (agentResponseTime / 100), 100)} 
              className="h-2" 
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">User Response</Label>
              <span className="text-sm font-medium">{userResponseTime}ms</span>
            </div>
            <Progress 
              value={Math.min(100 - (userResponseTime / 50), 100)} 
              className="h-2" 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
