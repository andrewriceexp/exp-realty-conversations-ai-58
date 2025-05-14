
import {
  Toast,
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast";

import {
  useToast as useToastInternal
} from "@/components/ui/use-toast";

// Re-export types
export type { Toast, ToastProps, ToastActionElement };

// Proxy the useToast hook
export const useToast = useToastInternal;

// Export the toast function
export const toast = (props: ToastProps) => {
  const { toast: internalToast } = useToastInternal();
  return internalToast(props);
};
