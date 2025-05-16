
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainLayout from "@/components/MainLayout";
import ProspectLists from "@/components/prospects/ProspectLists";
import ProspectImport from "@/components/prospects/ProspectImport";
import ProspectDetails from "@/components/prospects/ProspectDetails";
import { ElevenLabsAgentManager } from "@/components/agent-config/ElevenLabsAgentManager";
import { ProspectList } from "@/types";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, AlertTriangle } from "lucide-react";
import { isAnonymizationEnabled, setAnonymizationEnabled } from "@/utils/anonymizationUtils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useLocation } from "react-router-dom";

const ProspectManagement = () => {
  const [selectedList, setSelectedList] = useState<ProspectList | null>(null);
  const [activeTab, setActiveTab] = useState("lists");
  const [anonymizeData, setAnonymizeData] = useState(isAnonymizationEnabled());
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Set active tab based on navigation state if provided
  useEffect(() => {
    if (location.state?.activeTab && ['lists', 'import', 'elevenlabs', 'details'].includes(location.state.activeTab)) {
      setActiveTab(location.state.activeTab);
      
      // Clear the state so refreshing the page doesn't trigger this again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Update localStorage when anonymization preference changes
  useEffect(() => {
    setAnonymizationEnabled(anonymizeData);
  }, [anonymizeData]);

  const handleListSelect = (list: ProspectList) => {
    setSelectedList(list);
    setActiveTab("details");
  };

  const toggleAnonymization = () => {
    setAnonymizeData(prev => !prev);
    toast({
      title: anonymizeData ? "Data visible" : "Data anonymized",
      description: anonymizeData 
        ? "Customer data is now displayed in its original form." 
        : "Customer data is now anonymized for privacy and compliance.",
    });
  };

  const handleNavigateToProfile = () => {
    navigate('/profile-setup');
  };

  const needsElevenLabsSetup = !profile?.elevenlabs_api_key;

  return (
    <MainLayout>
      <div className="space-y-4">
        {needsElevenLabsSetup && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              ElevenLabs API key not configured. Voice AI features will not work until you 
              <button 
                onClick={handleNavigateToProfile}
                className="text-primary font-medium underline ml-1"
              >
                configure your ElevenLabs API key
              </button>.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Prospect Management</h1>
            <p className="text-muted-foreground">
              Create and manage prospect lists for your calling campaigns.
            </p>
          </div>
          
          <div className="flex items-center space-x-2 bg-muted p-2 rounded">
            <Switch 
              checked={anonymizeData} 
              onCheckedChange={toggleAnonymization} 
              id="global-anonymize-data" 
            />
            <label 
              htmlFor="global-anonymize-data" 
              className="text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              {anonymizeData ? (
                <>
                  <EyeOffIcon className="h-4 w-4" /> Privacy Mode
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4" /> Normal View
                </>
              )}
            </label>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="elevenlabs">ElevenLabs Agents</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedList}>
              {selectedList ? (anonymizeData 
                ? `List: ${selectedList.list_name.slice(0, 3)}...` 
                : `List: ${selectedList.list_name}`
              ) : "List Details"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lists" className="py-4">
            <ProspectLists onSelectList={handleListSelect} />
          </TabsContent>
          <TabsContent value="import" className="py-4">
            <ProspectImport onSuccess={() => setActiveTab("lists")} />
          </TabsContent>
          <TabsContent value="elevenlabs" className="py-4">
            <ElevenLabsAgentManager />
          </TabsContent>
          <TabsContent value="details" className="py-4">
            {selectedList && <ProspectDetails list={selectedList} />}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ProspectManagement;
