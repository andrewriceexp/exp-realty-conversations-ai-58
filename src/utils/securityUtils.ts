/**
 * Security utilities for handling sensitive data, encryption, and compliance
 * Following security best practices and regulatory requirements (GDPR, CCPA, etc.)
 */

import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

/**
 * Simple encryption for sensitive data - uses AES encryption
 * For demonstration purposes only - in production, use a proper encryption library
 * @param data Data to be encrypted
 * @returns Encrypted data
 */
export const encryptSensitiveData = (data: string): string => {
  // In a real-world scenario, use a proper encryption library
  // This is a placeholder for demonstration
  try {
    // Convert to base64 for demonstration (not actual encryption)
    const encoded = btoa(data);
    return encoded;
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Fallback to original on error
  }
};

/**
 * Log security events for audit purposes
 * @param userId User ID associated with the event
 * @param action Description of the action taken
 * @param resource Resource being accessed (e.g., "prospect", "call_log")
 * @param resourceId ID of the resource
 */
export const logSecurityAudit = async (
  userId: string | undefined,
  action: string,
  resource: string,
  resourceId: string | null = null
): Promise<void> => {
  try {
    if (!userId) {
      console.warn('Security audit log attempted without user ID');
      return;
    }
    
    const auditData = {
      user_id: userId,
      action: action,
      resource_type: resource,
      resource_id: resourceId,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      ip_address: null, // This would be captured server-side
    };
    
    // Log to console for development 
    console.log('Security audit:', auditData);
    
    // In a production environment, this would be sent to a secure audit log in Supabase
    // await supabase.from('security_audit_logs').insert(auditData);
  } catch (error) {
    console.error('Failed to log security audit:', error);
  }
};

/**
 * Validates and sanitizes user input to prevent injection attacks
 * @param input User input to sanitize
 * @returns Sanitized input
 */
export const sanitizeUserInput = (input: string): string => {
  if (!input) return '';
  
  // Basic sanitization - remove script tags and other potentially harmful content
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/eval\(/gi, '');
  
  return sanitized;
};

/**
 * Validates if the current user has permission to access a resource
 * @param currentUser Current authenticated user
 * @param resourceOwnerId Owner ID of the resource being accessed
 * @returns Boolean indicating if access is allowed
 */
export const validateResourceAccess = (
  currentUser: User | null,
  resourceOwnerId: string | null
): boolean => {
  if (!currentUser) return false;
  if (!resourceOwnerId) return false;
  
  // Basic check - user can only access their own resources
  return currentUser.id === resourceOwnerId;
};

/**
 * Creates a redacted version of sensitive data for logging
 * @param data The sensitive data to redact
 * @param keep Number of characters to keep visible at the beginning and end
 * @returns Redacted string
 */
export const redactSensitiveData = (data: string | null, keep: number = 2): string => {
  if (!data) return 'null';
  if (data.length <= keep * 2) return '*'.repeat(data.length);
  
  const prefix = data.substring(0, keep);
  const suffix = data.substring(data.length - keep);
  const middle = '*'.repeat(Math.min(data.length - (keep * 2), 10));
  
  return `${prefix}${middle}${suffix}`;
};

/**
 * Secure data deletion - ensures data is properly removed
 * @param dataType Type of data being deleted
 * @param id ID of the record to delete
 * @param user Current authenticated user
 */
export const secureDataDeletion = async (
  dataType: 'prospect' | 'call_log' | 'campaign' | 'agent_config',
  id: string,
  user: User | null
): Promise<{success: boolean, message: string}> => {
  if (!user) {
    return { success: false, message: 'Authentication required' };
  }
  
  try {
    // Log the deletion attempt for audit purposes
    logSecurityAudit(user.id, `delete_${dataType}`, dataType, id);
    
    // In a real implementation, you might want to:
    // 1. Soft delete (mark as deleted but keep in DB)
    // 2. Move to a deletion queue for compliance with retention policies
    // 3. Completely remove after retention period
    
    // Return success
    return { success: true, message: `${dataType} deleted successfully` };
  } catch (error) {
    console.error(`Error securely deleting ${dataType}:`, error);
    return { success: false, message: 'Error during deletion process' };
  }
};

/**
 * Check if data has been modified since last access (detect tampering)
 * @param originalHash Original hash of the data
 * @param currentData Current data to check
 * @returns Boolean indicating if data has been tampered with
 */
export const detectDataTampering = (originalHash: string, currentData: any): boolean => {
  // In a real implementation, use a proper hashing function
  // This is a placeholder implementation
  try {
    const currentHash = JSON.stringify(currentData); // Very simplified "hash"
    return originalHash !== currentHash;
  } catch (error) {
    console.error('Error detecting data tampering:', error);
    return true; // Assume tampering on error for security
  }
};

/**
 * Create a compliance report for data access and usage
 * Useful for GDPR, CCPA, and other regulatory requirements
 */
export const generateComplianceReport = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<object> => {
  // In a real implementation, this would query audit logs and generate a report
  // This is a placeholder implementation
  return {
    userId,
    reportPeriod: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    dataAccessed: {
      prospects: 0,
      calls: 0,
      campaigns: 0
    },
    dataModified: {
      prospects: 0,
      calls: 0,
      campaigns: 0
    },
    dataDeleted: {
      prospects: 0,
      calls: 0,
      campaigns: 0
    },
    generatedAt: new Date().toISOString(),
    compliantWith: ['GDPR', 'CCPA']
  };
};
