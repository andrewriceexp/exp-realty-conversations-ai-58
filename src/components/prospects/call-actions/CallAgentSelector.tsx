import { useState, useEffect } from 'react';
import { useAgentConfigs } from '@/hooks/useAgentConfigs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CallAgentSelectorProps {
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
  className?: string;
}

const CallAgentSelector = ({
  selectedConfigId,
  setSelectedConfigId,
  className
}: CallAgentSelectorProps) => {
  const { agentConfigs, isLoading, error } = useAgentConfigs();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Select onValueChange={setSelectedConfigId} defaultValue={selectedConfigId}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select agent" />
      </SelectTrigger>
      <SelectContent>
        {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
        {error && <SelectItem value="error" disabled>Error: {error}</SelectItem>}
        {agentConfigs?.map((config) => (
          <SelectItem key={config.id} value={config.id}>
            {config.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CallAgentSelector;
