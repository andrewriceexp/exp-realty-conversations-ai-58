
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
  const { configs, isLoading, createNewConfig, handleDelete, handleSave } = useAgentConfigs();
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
        {!isLoading && configs.length === 0 && (
          <SelectItem value="error" disabled>No agent configurations found</SelectItem>
        )}
        {configs?.map((config) => (
          <SelectItem key={config.id} value={config.id}>
            {config.config_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CallAgentSelector;
