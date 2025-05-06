
import { useState } from "react";
import { Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campaign } from "@/types";
import { useCampaigns } from "@/hooks/useCampaigns";
import CreateCampaignDialog from "./CreateCampaignDialog";
import EmptyCampaignListState from "./EmptyCampaignListState";
import CampaignListTable from "./CampaignListTable";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignListProps {
  onSelectCampaign: (campaign: Campaign) => void;
}

const CampaignList = ({ onSelectCampaign }: CampaignListProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { campaigns, loading, addCampaign, deleteCampaign, updateCampaignStatus } = useCampaigns();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Your Campaigns</h3>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyCampaignListState onCreateClick={() => setIsDialogOpen(true)} />
      ) : (
        <CampaignListTable 
          campaigns={campaigns} 
          onSelectCampaign={onSelectCampaign}
          onDeleteCampaign={deleteCampaign}
          onUpdateStatus={updateCampaignStatus}
        />
      )}

      <CreateCampaignDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCampaignCreated={addCampaign}
      />
    </div>
  );
};

export default CampaignList;
