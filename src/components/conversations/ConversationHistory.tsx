
import { useState } from 'react';
import { 
  ConversationHistoryEntry, 
  useConversationHistory 
} from '@/hooks/useConversationHistory';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader2, MoreVertical, Clock, MessageCircle, RefreshCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ConversationHistoryProps {
  maxHeight?: string;
}

export default function ConversationHistory({ maxHeight = "400px" }: ConversationHistoryProps) {
  const { 
    history, 
    isLoading, 
    fetchHistory, 
    deleteConversation,
    getConversationDetails
  } = useConversationHistory();
  
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Handle viewing conversation details
  const handleViewDetails = async (id: string) => {
    const details = await getConversationDetails(id);
    if (details) {
      setSelectedConversation(details);
      setIsDetailsOpen(true);
    }
  };
  
  // Handle deleting a conversation
  const handleDeleteConversation = async (id: string) => {
    setIsDeleting(id);
    await deleteConversation(id);
    setIsDeleting(null);
  };
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Conversation History</CardTitle>
            <CardDescription>Recent test conversations</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchHistory()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className={`h-[${maxHeight}]`}>
            {history.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="hidden md:table-cell">Prospect</TableHead>
                    <TableHead className="hidden sm:table-cell">Duration</TableHead>
                    <TableHead className="hidden sm:table-cell">Messages</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((conversation) => (
                    <TableRow key={conversation.id}>
                      <TableCell className="font-medium">
                        {format(conversation.timestamp, 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        {conversation.agentName || "Unknown Agent"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {conversation.prospectName || "Test User"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          {conversation.duration}s
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center">
                          <MessageCircle className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          {conversation.messageCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isDeleting === conversation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleViewDetails(conversation.id)}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteConversation(conversation.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    <p>Loading conversation history...</p>
                  </div>
                ) : (
                  <p>No conversation history yet. Test a conversation to see it here.</p>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Conversation details dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conversation Details</DialogTitle>
            <DialogDescription>
              {selectedConversation && (
                <>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">
                      {format(new Date(selectedConversation.started_at), 'PPpp')}
                    </Badge>
                    <Badge variant="outline">
                      Duration: {selectedConversation.call_duration_seconds || 0}s
                    </Badge>
                    <Badge variant="outline">
                      Messages: {selectedConversation.parsedTranscript?.length || 0}
                    </Badge>
                  </div>
                  {selectedConversation.summary && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="font-medium">Summary:</p>
                      <p className="text-sm">{selectedConversation.summary}</p>
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedConversation?.parsedTranscript && (
            <ScrollArea className="h-[400px] mt-4">
              <div className="space-y-4">
                {selectedConversation.parsedTranscript.map((message: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground ml-12' 
                        : 'bg-muted mr-12'
                    }`}
                  >
                    <div className="text-xs mb-1 opacity-70">
                      {message.role === 'user' ? 'You' : 'Assistant'} • {
                        message.timestamp && format(new Date(message.timestamp), 'h:mm a')
                      }
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailsOpen(false)}
            >
              Close
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (selectedConversation?.id) {
                  handleDeleteConversation(selectedConversation.id);
                  setIsDetailsOpen(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
