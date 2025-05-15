
// Export everything from the hooks implementation 
export {
  useToast,
  toast,
  Toaster,
  ToastAction,
  toast as setToast,  // Export toast as setToast for backward compatibility
  type Toast,
  type ToastProps,
  type ToastActionElement,
  type ToasterToast
} from "./use-toast.tsx";
