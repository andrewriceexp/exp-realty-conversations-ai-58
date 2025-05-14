
// This file re-exports from shadcn/ui's toast implementation
import { useToast as useToastImpl, toast as toastImpl } from "@/components/ui/toast";

// Re-export with explicit names to avoid circular references
export const useToast = useToastImpl;
export const toast = toastImpl;
