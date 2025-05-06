
import { Play, Pause, Trash, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campaign } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface CampaignListTableProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (id: string, name: string) => Promise<boolean>;
  onUpdateStatus?: (id: string, status: Campaign["status"]) => Promise<boolean>;
}

const CampaignListTable = ({ 
  campaigns, 
  onSelectCampaign, 
  onDeleteCampaign,
  onUpdateStatus 
}: CampaignListTableProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'bg-green-100 text-green-800';
      case 'Paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Scheduled':
        return 'bg-purple-100 text-purple-800';
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleActionClick = (e: React.MouseEvent, campaignId: string, action: string) => {
    e.stopPropagation();
    
    if (!onUpdateStatus) return;
    
    switch (action) {
      case 'start':
        onUpdateStatus(campaignId, 'Running');
        break;
      case 'pause':
        onUpdateStatus(campaignId, 'Paused');
        break;
      case 'schedule':
        // This would typically open a scheduling dialog
        console.log('Schedule campaign:', campaignId);
        break;
      default:
        break;
    }
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                No campaigns found
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((campaign) => (
              <TableRow 
                key={campaign.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectCampaign(campaign)}
              >
                <TableCell>
                  <div className="font-medium">{campaign.name}</div>
                  {campaign.prospect_list_name && (
                    <div className="text-xs text-muted-foreground">
                      List: {campaign.prospect_list_name}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </TableCell>
                <TableCell>{formatDate(campaign.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end space-x-1">
                    {onUpdateStatus && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {campaign.status !== 'Running' && (
                            <DropdownMenuItem onClick={(e) => handleActionClick(e, campaign.id, 'start')}>
                              <Play className="mr-2 h-4 w-4" />
                              Start Campaign
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'Running' && (
                            <DropdownMenuItem onClick={(e) => handleActionClick(e, campaign.id, 'pause')}>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause Campaign
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === 'Draft' || campaign.status === 'Paused') && (
                            <DropdownMenuItem onClick={(e) => handleActionClick(e, campaign.id, 'schedule')}>
                              <Clock className="mr-2 h-4 w-4" />
                              Schedule
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCampaign(campaign.id, campaign.name);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CampaignListTable;
