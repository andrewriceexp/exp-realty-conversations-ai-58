
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Prospect, ProspectList } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getCustomerDataFromTwilio, TwilioCustomerData } from '@/utils/twilioCustomerManager';

export const useProspectDetails = (list: ProspectList) => {
  const { user } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);
  const { toast } = useToast();

  // Fetch the prospect metadata (minimal data stored in our system)
  const fetchProspects = async () => {
    try {
      setLoading(true);
      if (!list?.id || !user) return;

      // Fetch prospects for this list
      const { data: prospectsData, error: prospectsError } = await supabase
        .from('prospects')
        .select('id, list_id, user_id, twilio_customer_id, status, last_call_attempted, created_at, updated_at')
        .eq('list_id', list.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (prospectsError) throw prospectsError;
      setProspects(prospectsData || []);
      
      // Log for debugging
      console.log(`Fetched ${prospectsData?.length || 0} prospects for list ${list.id}`);
      
    } catch (error: any) {
      console.error('Error fetching prospects:', error);
      toast({
        title: "Error loading prospects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load the actual customer data from Twilio when a prospect is selected
  const loadCustomerData = async (prospect: Prospect) => {
    if (!user || !prospect.twilio_customer_id) return;
    
    try {
      setLoadingCustomerData(true);
      
      // Fetch detailed customer data from Twilio
      const customerData = await getCustomerDataFromTwilio(
        prospect.twilio_customer_id, 
        user.id
      );
      
      // Merge the data with our minimal prospect data
      setSelectedProspect({
        ...prospect,
        ...customerData
      });
      
    } catch (error: any) {
      console.error('Error loading customer data from Twilio:', error);
      toast({
        title: "Error loading customer details",
        description: error.message,
        variant: "destructive",
      });
      // Still set the prospect, but without the detailed data
      setSelectedProspect(prospect);
    } finally {
      setLoadingCustomerData(false);
    }
  };

  // Handle selecting a prospect from the list
  const handleProspectSelect = async (prospect: Prospect) => {
    await loadCustomerData(prospect);
  };

  useEffect(() => {
    fetchProspects();
  }, [list.id]);

  return {
    prospects,
    selectedProspect,
    loading,
    loadingCustomerData,
    handleProspectSelect,
    setSelectedProspect,
    fetchProspects
  };
};
