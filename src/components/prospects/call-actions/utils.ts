
/**
 * Returns a description of a call status
 */
export const getStatusDescription = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'queued': return 'Call has been queued and will be initiated shortly';
    case 'initiated': return 'Call has been initiated and is connecting';
    case 'ringing': return 'Phone is ringing';
    case 'in-progress': return 'Call is in progress';
    case 'completed': return 'Call has completed successfully';
    case 'busy': return 'Recipient was busy';
    case 'failed': return 'Call failed to complete';
    case 'no-answer': return 'Recipient did not answer';
    case 'canceled': return 'Call was canceled';
    default: return `Current status: ${status}`;
  }
};

/**
 * Checks if an error is related to profile configuration
 */
export const isProfileError = (errorCode: string | null, errorMessage: string | null): boolean => {
  return errorCode === 'PROFILE_NOT_FOUND' || 
         errorCode === 'TWILIO_CONFIG_INCOMPLETE' || 
         (errorMessage && (
           errorMessage.includes('Profile') || 
           errorMessage.includes('Twilio configuration')
         ));
};
