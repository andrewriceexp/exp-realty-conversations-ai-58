/**
 * Utility functions for anonymizing sensitive data in the application
 * Used for privacy, security, and compliance purposes
 */

/**
 * Anonymizes a phone number by masking all but the last 4 digits
 * @param phoneNumber The phone number to anonymize
 * @returns The anonymized phone number
 */
export const anonymizePhoneNumber = (phoneNumber: string | null): string => {
  if (!phoneNumber) return 'N/A';
  
  // Clean the phone number by removing any non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If the phone number is too short, return a fully masked version
  if (cleaned.length < 4) {
    return 'xxx-xxxx';
  }
  
  // Mask all but the last 4 digits
  const lastFour = cleaned.slice(-4);
  const maskedLength = cleaned.length - 4;
  const masked = 'x'.repeat(maskedLength);
  
  // Format the masked phone number
  if (cleaned.length === 10) {
    // Format as (xxx) xxx-1234
    return `(${masked.slice(0, 3)}) ${masked.slice(3)}-${lastFour}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Format as +1 (xxx) xxx-1234
    return `+1 (${masked.slice(1, 4)}) ${masked.slice(4)}-${lastFour}`;
  } else {
    // Generic format for other lengths
    return `${masked}-${lastFour}`;
  }
};

/**
 * Anonymizes a name by replacing all but the first letter with asterisks
 * @param name The name to anonymize
 * @returns The anonymized name
 */
export const anonymizeName = (name: string | null): string => {
  if (!name) return 'N/A';
  
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  
  // Keep the first letter, replace the rest with asterisks
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 1)}`;
};

/**
 * Anonymizes an address by keeping only the street number and zip code
 * @param address The address to anonymize
 * @returns The anonymized address
 */
export const anonymizeAddress = (address: string | null): string => {
  if (!address) return 'N/A';
  
  const trimmed = address.trim();
  if (!trimmed) return 'N/A';
  
  // Extract potential street number from beginning of address
  const streetNumberMatch = trimmed.match(/^(\d+)/);
  const streetNumber = streetNumberMatch ? streetNumberMatch[0] : '';
  
  // Extract potential zip code from end of address (assumes US format)
  const zipMatch = trimmed.match(/(\d{5}(-\d{4})?)$/);
  const zip = zipMatch ? zipMatch[0] : '';
  
  if (streetNumber && zip) {
    return `${streetNumber} *** ${zip}`;
  } else if (streetNumber) {
    return `${streetNumber} ***`;
  } else if (zip) {
    return `*** ${zip}`;
  } else {
    // If no identifiable parts, mask everything
    return '***';
  }
};

/**
 * Anonymizes all sensitive fields in a prospect object
 * @param prospect The prospect object to anonymize
 * @returns A new object with anonymized data
 */
export const anonymizeProspect = (prospect: any): any => {
  if (!prospect) return null;
  
  return {
    ...prospect,
    phone_number: anonymizePhoneNumber(prospect.phone_number),
    first_name: anonymizeName(prospect.first_name),
    last_name: anonymizeName(prospect.last_name),
    property_address: anonymizeAddress(prospect.property_address),
    // Keep these fields as they are not personally identifiable
    id: prospect.id,
    list_id: prospect.list_id,
    user_id: prospect.user_id,
    status: prospect.status,
    last_call_attempted: prospect.last_call_attempted,
    created_at: prospect.created_at,
    updated_at: prospect.updated_at,
    notes: prospect.notes ? '***' : null, // Completely hide notes as they may contain sensitive info
  };
};

/**
 * Toggles anonymization for displaying data in the UI
 * For demonstration/development purposes
 */
export const isAnonymizationEnabled = (): boolean => {
  // This could be stored in localStorage or fetched from user preferences
  const stored = localStorage.getItem('anonymizationEnabled');
  return stored === 'true';
};

/**
 * Sets the anonymization preference
 * @param enabled Whether anonymization should be enabled
 */
export const setAnonymizationEnabled = (enabled: boolean): void => {
  localStorage.setItem('anonymizationEnabled', enabled.toString());
};
