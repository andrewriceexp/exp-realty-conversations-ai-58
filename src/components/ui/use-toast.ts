
// This is the actual implementation that components/ui/toast.tsx will use
import { useToast as useHookToast, toast as hookToast } from "@/hooks/use-toast";

export const useToast = useHookToast;
export const toast = hookToast;
