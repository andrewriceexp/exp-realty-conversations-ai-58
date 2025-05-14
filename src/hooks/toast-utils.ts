
// Global toast function that will work outside React components
let toastFn: Function | null = null;

// Function to set the toast function once the Toaster component has mounted
export function setToast(toast: Function) {
  toastFn = toast;
}

// Exported toast function that can be used anywhere
export function toast(props: any) {
  if (toastFn) {
    return toastFn(props);
  }
  
  // Log errors if attempting to use toast before it's initialized
  console.error("Toast attempted to be used before it was initialized");
  return {
    id: "",
    dismiss: () => {},
    update: () => {},
  };
}
