
import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle } from 'lucide-react';
import { useElevenLabs } from '@/hooks/useElevenLabs';
import { ConfigList } from '@/components/agent-config/ConfigList';
import { ConfigEditor } from '@/components/agent-config/ConfigEditor';
import { EmptyConfigState } from '@/components/agent-config/EmptyConfigState';
import { useAgentConfigs } from '@/hooks/useAgentConfigs';

const AgentConfigPage = () => {
  const { getVoices, isLoading: voicesLoading } = useElevenLabs();
  const [voices, setVoices] = useState<any[]>([]);

  const {
    configs,
    currentConfig,
    setCurrentConfig,
    isLoading,
    isSaving,
    createNewConfig,
    handleSave,
    handleDelete,
    selectConfig,
  } = useAgentConfigs();

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voiceData = await getVoices();
        setVoices(voiceData);
      } catch (error) {
        console.error('Error fetching voices:', error);
      }
    };
    
    fetchVoices();
  }, []);

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Agent Configurations</h1>
          <Button onClick={createNewConfig}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Configuration
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar with config list */}
            <div className="lg:col-span-1">
              <ConfigList 
                configs={configs} 
                currentConfig={currentConfig} 
                onSelectConfig={selectConfig}
                onDeleteConfig={handleDelete}
              />
            </div>
            
            {/* Main config editor */}
            <div className="lg:col-span-3">
              {currentConfig ? (
                <ConfigEditor 
                  currentConfig={currentConfig}
                  isSaving={isSaving}
                  onConfigChange={setCurrentConfig}
                  onSave={handleSave}
                  voices={voices}
                  voicesLoading={voicesLoading}
                />
              ) : (
                <EmptyConfigState onCreate={createNewConfig} />
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AgentConfigPage;
