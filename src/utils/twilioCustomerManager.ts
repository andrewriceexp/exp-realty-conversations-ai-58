
import { supabase } from '@/lib/supabase';

// Interface for the minimal prospect information we'll store
export interface MinimalProspect {
  id: string;
  list_id: string;
  user_id: string;
  twilio_customer_id: string;
  status: string;
  last_call_attempted: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for the full customer data that we'll only store in Twilio
export interface TwilioCustomerData {
  phone_number: string;
  first_name?: string | null;
  last_name?: string | null;
  property_address?: string | null;
  notes?: string | null;
}

// Get Twilio API credentials from user profile
export const getTwilioCredentials = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('twilio_account_sid, twilio_auth_token, twilio_phone_number')
    .eq('id', userId)
    .single();
    
  if (error) {
    throw new Error(`Failed to get Twilio credentials: ${error.message}`);
  }
  
  if (!data.twilio_account_sid || !data.twilio_auth_token || !data.twilio_phone_number) {
    throw new Error('Twilio credentials not configured. Please update your profile.');
  }
  
  return data;
};

// Helper to retrieve customer data from Twilio (will be implemented in edge function)
export const getCustomerDataFromTwilio = async (
  twilio_customer_id: string,
  userId: string
): Promise<TwilioCustomerData> => {
  try {
    // Call the edge function to retrieve customer data from Twilio
    const { data, error } = await supabase.functions.invoke('twilio-get-customer', {
      body: { 
        twilio_customer_id,
        userId 
      }
    });
    
    if (error) throw new Error(error.message);
    return data as TwilioCustomerData;
  } catch (error: any) {
    console.error('Error retrieving customer data from Twilio:', error);
    throw new Error(`Failed to retrieve customer data: ${error.message}`);
  }
};

// Create a new customer in Twilio and return the ID (will be implemented in edge function)
export const createCustomerInTwilio = async (
  customerData: TwilioCustomerData,
  userId: string
): Promise<string> => {
  try {
    // Call the edge function to create a customer in Twilio
    const { data, error } = await supabase.functions.invoke('twilio-create-customer', {
      body: { 
        customerData,
        userId 
      }
    });
    
    if (error) throw new Error(error.message);
    return data.twilio_customer_id;
  } catch (error: any) {
    console.error('Error creating customer in Twilio:', error);
    throw new Error(`Failed to create customer: ${error.message}`);
  }
};
