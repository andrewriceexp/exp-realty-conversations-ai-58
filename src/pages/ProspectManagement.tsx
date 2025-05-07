
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainLayout from "@/components/MainLayout";
import ProspectLists from "@/components/prospects/ProspectLists";
import ProspectImport from "@/components/prospects/ProspectImport";
import ProspectDetails from "@/components/prospects/ProspectDetails";
import SheetExample from "@/components/prospects/SheetExample";
import { ProspectList } from "@/types";

const ProspectManagement = () => {
  const [selectedList, setSelectedList] = useState<ProspectList | null>(null);
  const [activeTab, setActiveTab] = useState("lists");

  const handleListSelect = (list: ProspectList) => {
    setSelectedList(list);
    setActiveTab("details");
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Prospect Management</h1>
          <p className="text-muted-foreground">
            Create and manage prospect lists for your calling campaigns.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="sheet-example">Sheet Example</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedList}>
              {selectedList ? `List: ${selectedList.list_name}` : "List Details"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lists" className="py-4">
            <ProspectLists onSelectList={handleListSelect} />
          </TabsContent>
          <TabsContent value="import" className="py-4">
            <ProspectImport onSuccess={() => setActiveTab("lists")} />
          </TabsContent>
          <TabsContent value="sheet-example" className="py-4">
            <SheetExample />
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
