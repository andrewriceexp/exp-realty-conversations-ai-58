
import { useToast } from "./use-toast";

// Global toast function that will work outside React components
let toastFn: ReturnType<typeof useToast>["toast"] | null = null;

// Function to set the toast function once the Toaster component has mounted
export function setToast(toast: ReturnType<typeof useToast>["toast"]) {
  toastFn = toast;
}

// Exported toast function that can be used anywhere
export function toast(props: Parameters<ReturnType<typeof useToast>["toast"]>[0]) {
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

// Initialize toast service in the ToastProvider component
export function initializeToast() {
  const { toast } = useToast();
  setToast(toast);
}
