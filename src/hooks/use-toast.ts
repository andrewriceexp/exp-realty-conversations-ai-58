
// src/hooks/use-toast.ts
import { useToast as useToastUI } from "@/components/ui/use-toast";
import { toast as toastUI } from "@/components/ui/use-toast";

// Re-export with friendly names
export const useToast = useToastUI;
export const toast = toastUI;
