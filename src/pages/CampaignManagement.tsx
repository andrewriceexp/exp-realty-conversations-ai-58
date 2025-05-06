
import { useState } from "react";
import MainLayout from "@/components/MainLayout";
import { useToast } from "@/hooks/use-toast";
import CampaignList from "@/components/campaigns/CampaignList";
import EmptyCampaignState from "@/components/campaigns/EmptyCampaignState";
import { Campaign } from "@/types";

const CampaignManagement = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const { toast } = useToast();
  
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
                <h2 className="text-xl font-semibold mb-4">{selectedCampaign.name} Details</h2>
                <p className="text-muted-foreground mb-2">Coming soon: Campaign details and call progress</p>
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
