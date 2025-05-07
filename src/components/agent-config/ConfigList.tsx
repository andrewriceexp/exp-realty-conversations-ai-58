
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentConfig } from "@/types";
import { Trash2 } from "lucide-react";

interface ConfigListProps {
  configs: AgentConfig[];
  currentConfig: AgentConfig | null;
  onSelectConfig: (config: AgentConfig) => void;
  onDeleteConfig: (id: string, name: string) => void;
}

export const ConfigList = ({ configs, currentConfig, onSelectConfig, onDeleteConfig }: ConfigListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Configurations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {configs.length === 0 && !currentConfig && (
            <div className="text-center py-4 text-muted-foreground">
              No configurations yet. Create your first one!
            </div>
          )}
          
          {configs.map(config => (
            <div 
              key={config.id}
              className={`p-3 rounded-md cursor-pointer flex justify-between items-center ${
                currentConfig?.id === config.id ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
              onClick={() => onSelectConfig(config)}
            >
              <span className="font-medium">{config.config_name}</span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConfig(config.id, config.config_name);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
