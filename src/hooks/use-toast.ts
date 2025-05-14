
import { toast as sonnerToast } from "sonner";
import { useToast as useToastPrimitive } from "@/components/ui/toast";

// Re-export useToast from ui/toast
export const useToast = useToastPrimitive;

// Re-export toast function with enhanced functionality
export const toast = (props: Parameters<typeof sonnerToast>[0]) => {
  if (typeof props === "string") {
    return sonnerToast(props);
  }
  
  // Handle the case when props is an object with title and description
  return sonnerToast(props.title || "", {
    description: props.description,
    variant: props.variant as any,
    action: props.action,
    ...props,
  });
};
