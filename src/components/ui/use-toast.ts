
// Re-export from the hook implementation
import { useToast as useToastHook, toast as toastFunction, ToastProvider } from "@/hooks/use-toast";

// Re-export with names that match the expected API
export const useToast = useToastHook;
export const toast = toastFunction;
export { ToastProvider };
