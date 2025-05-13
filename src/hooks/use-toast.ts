
import { Toast, toast as toastFn } from "@/components/ui/toast";
import { useToast as useToastUI } from "@/components/ui/use-toast";

// Re-export the useToast hook from ui/use-toast
export const useToast = useToastUI;

// Re-export the toast function from ui/toast
export const toast = toastFn;

// Also export the Toast type for consistency
export type { Toast };
