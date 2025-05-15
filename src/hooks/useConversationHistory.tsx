
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface ConversationHistoryEntry {
  id: string;
  agentId: string;
  agentName?: string;
  prospectName?: string;
  timestamp: Date;
  duration: number;
  messageCount: number;
  summary?: string;
}

export function useConversationHistory() {
  const [history, setHistory] = useState<ConversationHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch conversation history from the database
  const fetchHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Get test conversation logs from the call_logs table
      const { data, error: fetchError } = await supabase
        .from('call_logs')
        .select(`
          id, 
          agent_config_id,
          started_at, 
          ended_at, 
          summary,
          prospect_id,
          call_duration_seconds,
          transcript
        `)
        .eq('user_id', user.id)
        .eq('call_status', 'test')
        .order('started_at', { ascending: false })
        .limit(20);
        
      if (fetchError) throw fetchError;
      
      // Transform the data to match our interface
      const historyEntries = await Promise.all((data || []).map(async (log) => {
        // Get agent name if possible
        let agentName = "Unknown Agent";
        try {
          if (log.agent_config_id) {
            const { data: agentData } = await supabase
              .from('agent_configs')
              .select('config_name')
              .eq('id', log.agent_config_id)
              .single();
              
            if (agentData) {
              agentName = agentData.config_name;
            }
          }
        } catch (e) {
          console.error("Failed to fetch agent name:", e);
        }
        
        // Get prospect name if possible
        let prospectName = "Test Prospect";
        try {
          if (log.prospect_id) {
            const { data: prospectData } = await supabase
              .from('prospects')
              .select('first_name, last_name')
              .eq('id', log.prospect_id)
              .single();
              
            if (prospectData) {
              prospectName = [prospectData.first_name, prospectData.last_name]
                .filter(Boolean)
                .join(' ') || "Test Prospect";
            }
          }
        } catch (e) {
          console.error("Failed to fetch prospect name:", e);
        }
        
        // Count messages in transcript
        let messageCount = 0;
        if (log.transcript) {
          try {
            const transcript = typeof log.transcript === 'string' 
              ? JSON.parse(log.transcript) 
              : log.transcript;
            
            messageCount = Array.isArray(transcript) ? transcript.length : 0;
          } catch (e) {
            console.error("Failed to parse transcript:", e);
          }
        }
        
        return {
          id: log.id,
          agentId: log.agent_config_id || "",
          agentName,
          prospectName,
          timestamp: new Date(log.started_at),
          duration: log.call_duration_seconds || 0,
          messageCount,
          summary: log.summary || "No summary available"
        };
      }));
      
      setHistory(historyEntries);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversation history');
      toast({
        title: "Error fetching history",
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save a new conversation to history
  const saveConversation = async (
    agentId: string, 
    agentName: string, 
    messages: Array<{role: string; content: string; timestamp: Date}>,
    prospectName?: string,
    prospectPhone?: string,
    summary?: string
  ) => {
    if (!user) return;
    
    try {
      // Create a formatted transcript from messages
      const transcript = JSON.stringify(messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString()
      })));
      
      const duration = messages.length > 0 
        ? Math.round((Date.now() - messages[0].timestamp.getTime()) / 1000) 
        : 0;
        
      // First, create or get prospect ID if name/phone provided
      let prospectId = null;
      if (prospectName || prospectPhone) {
        const { data: prospect } = await supabase
          .from('prospects')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'Test')
          .eq('phone_number', prospectPhone || 'test-phone')
          .maybeSingle();
          
        if (prospect) {
          prospectId = prospect.id;
        } else {
          const { data: newProspect, error: prospectError } = await supabase
            .from('prospects')
            .insert({
              user_id: user.id,
              list_id: null,
              first_name: prospectName?.split(' ')[0] || 'Test',
              last_name: prospectName?.split(' ')[1] || 'User',
              phone_number: prospectPhone || 'test-phone',
              status: 'Test'
            })
            .select('id')
            .single();
            
          if (prospectError) throw prospectError;
          prospectId = newProspect?.id;
        }
      }
      
      // Then insert the call log
      const { data: log, error: logError } = await supabase
        .from('call_logs')
        .insert({
          user_id: user.id,
          agent_config_id: agentId,
          prospect_id: prospectId,
          started_at: messages.length > 0 ? messages[0].timestamp.toISOString() : new Date().toISOString(),
          ended_at: new Date().toISOString(),
          call_duration_seconds: duration,
          call_status: 'test',
          twilio_call_sid: 'test-' + Date.now(),
          transcript,
          summary: summary || generateSummary(messages)
        })
        .select('id')
        .single();
        
      if (logError) throw logError;
      
      // Refresh history
      await fetchHistory();
      
      return log?.id;
      
    } catch (err) {
      console.error("Failed to save conversation:", err);
      toast({
        title: "Error saving conversation",
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: "destructive"
      });
      return null;
    }
  };
  
  // Generate a simple summary from messages
  const generateSummary = (messages: Array<{role: string; content: string; timestamp: Date}>) => {
    if (messages.length === 0) return "No conversation recorded";
    
    // Get the first and last few messages
    const firstMessage = messages[0]?.content || "";
    const lastMessage = messages[messages.length - 1]?.content || "";
    
    return `Conversation with ${messages.length} messages. Started with: "${firstMessage.substring(0, 50)}${firstMessage.length > 50 ? '...' : ''}" and ended with: "${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}"`;
  };
  
  // Delete a conversation from history
  const deleteConversation = async (id: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('call_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      // Update state to remove the deleted item
      setHistory(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed from your history"
      });
      
    } catch (err) {
      toast({
        title: "Error deleting conversation",
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: "destructive"
      });
    }
  };
  
  // Get conversation details by ID
  const getConversationDetails = async (id: string) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
        
      if (error) throw error;
      
      // Parse transcript if available
      let messages = [];
      if (data.transcript) {
        try {
          const transcript = typeof data.transcript === 'string'
            ? JSON.parse(data.transcript)
            : data.transcript;
            
          messages = Array.isArray(transcript) ? transcript : [];
        } catch (e) {
          console.error("Failed to parse transcript:", e);
        }
      }
      
      return {
        ...data,
        parsedTranscript: messages
      };
      
    } catch (err) {
      console.error("Failed to fetch conversation details:", err);
      toast({
        title: "Error fetching conversation",
        description: err instanceof Error ? err.message : 'An unknown error occurred',
        variant: "destructive"
      });
      return null;
    }
  };
  
  // Load history when the user changes
  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [user]);
  
  return {
    history,
    isLoading,
    error,
    fetchHistory,
    saveConversation,
    deleteConversation,
    getConversationDetails
  };
}
