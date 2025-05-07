
/**
 * Utility functions for handling CSV operations
 */

/**
 * Generates a sample CSV file content with the required format
 */
export const generateSampleCsv = (): string => {
  const headers = ["phone_number", "first_name", "last_name", "property_address", "notes"];
  const sampleData = [
    ["5551234567", "John", "Doe", "123 Main St, Anytown, CA 90210", "Interested in selling"],
    ["5559876543", "Jane", "Smith", "456 Oak Ave, Somewhere, CA 94123", "Looking for investment property"],
    ["5552223333", "Robert", "Johnson", "789 Pine Rd, Nowhere, CA 92111", "Called previously in January"],
  ];
  
  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
};

/**
 * Creates and downloads a file with the given content
 */
export const downloadFile = (content: string, fileName: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parses a CSV string into an array of arrays
 */
export const parseCSV = (csvText: string): {headers: string[], rows: string[][]} => {
  const rows = csvText.split('\n').filter(row => row.trim());
  const headers = rows[0].split(',').map(header => header.trim().toLowerCase());
  
  const dataRows = rows.slice(1).map(row => {
    return row.split(',').map(cell => cell.trim());
  });
  
  return { headers, rows: dataRows };
};

/**
 * Validates a CSV file has the required headers
 */
export const validateCSVHeaders = (headers: string[]): {valid: boolean, message?: string} => {
  if (!headers.includes('phone_number')) {
    return {
      valid: false,
      message: "CSV must include a 'phone_number' column"
    };
  }
  
  return { valid: true };
};
