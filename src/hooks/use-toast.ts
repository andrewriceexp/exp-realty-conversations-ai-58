
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"
import {
  useToast as useToastOriginal,
} from "@/components/ui/use-toast"

export type { Toast, ToastProps, ToastActionElement }

export const useToast = useToastOriginal

// Simple toast function for easier usage
export function toast(message: string | ToastProps) {
  const { toast } = useToastOriginal()
  
  if (typeof message === 'string') {
    toast({
      description: message,
    })
  } else {
    toast(message)
  }
}
