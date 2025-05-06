
import { useState, useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { useToast } from "@/hooks/use-toast";
import CampaignList from "@/components/campaigns/CampaignList";
import EmptyCampaignState from "@/components/campaigns/EmptyCampaignState";
import { Campaign } from "@/types";
import { Button } from "@/components/ui/button";
import { Play, Pause, Clock } from "lucide-react";
import { formatDistance } from "date-fns";
import { useCampaigns } from "@/hooks/useCampaigns";

const CampaignManagement = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const { toast } = useToast();
  const { updateCampaignStatus } = useCampaigns();
  
  // Clear selected campaign if it doesn't exist anymore
  useEffect(() => {
    if (selectedCampaign) {
      // Logic to verify if the selected campaign still exists
      // If implementing real-time updates, would check here
    }
  }, [selectedCampaign]);

  const handleStatusChange = async (status: Campaign["status"]) => {
    if (!selectedCampaign) return;
    
    const success = await updateCampaignStatus(selectedCampaign.id, status);
    if (success) {
      setSelectedCampaign({
        ...selectedCampaign,
        status
      });
    }
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} (${formatDistance(date, new Date(), { addSuffix: true })})`;
    } catch (e) {
      return dateString;
    }
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Voice AI Campaigns</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <CampaignList onSelectCampaign={setSelectedCampaign} />
          </div>
          
          <div className="col-span-1 lg:col-span-2">
            {selectedCampaign ? (
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedCampaign.name}</h2>
                    <div className="flex items-center mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCampaign.status)}`}>
                        {selectedCampaign.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-x-2">
                    {selectedCampaign.status !== 'Running' && selectedCampaign.status !== 'Completed' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange('Running')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start
                      </Button>
                    )}
                    {selectedCampaign.status === 'Running' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange('Paused')}
                        variant="outline"
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                    )}
                    {selectedCampaign.status === 'Draft' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleStatusChange('Scheduled')}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Schedule
                      </Button>
                    )}
                  </div>
                </div>
                
                {selectedCampaign.description && (
                  <p className="text-muted-foreground mb-4">{selectedCampaign.description}</p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="border rounded-md p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Campaign Details</h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 text-sm">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="col-span-2">{formatDate(selectedCampaign.created_at)}</span>
                      </div>
                      {selectedCampaign.scheduled_start && (
                        <div className="grid grid-cols-3 text-sm">
                          <span className="text-muted-foreground">Scheduled Start:</span>
                          <span className="col-span-2">{formatDate(selectedCampaign.scheduled_start)}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 text-sm">
                        <span className="text-muted-foreground">Last Updated:</span>
                        <span className="col-span-2">{formatDate(selectedCampaign.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Resources</h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 text-sm">
                        <span className="text-muted-foreground">Prospect List:</span>
                        <span className="col-span-2">
                          {selectedCampaign.prospect_list_name || "Not selected"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 text-sm">
                        <span className="text-muted-foreground">AI Agent:</span>
                        <span className="col-span-2">
                          {selectedCampaign.agent_config_name || "Not selected"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-2">Campaign Progress</h3>
                  <div className="text-center py-6 text-muted-foreground">
                    <p>Campaign progress tracking and call logs will be displayed here.</p>
                    <p className="text-sm">Implement call progress tracking in the next iteration.</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyCampaignState />
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CampaignManagement;
