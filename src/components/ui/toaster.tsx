
"use client";

import { Toaster as ToastComponent } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useToast, toast } from "@/hooks/use-toast";

export function Toaster() {
  // Initialize the toast function when the component mounts
  const { toast: toastFn } = useToast();
  
  useEffect(() => {
    console.log("[Toaster] Initializing global toast function");
    
    // Test toast to verify initialization (uncomment for debugging)
    // toastFn({
    //   title: "Toast Initialized",
    //   description: "Toast notification system is ready",
    //   variant: "default"
    // });
    
    return () => {
      console.log("[Toaster] Cleaning up toast initialization");
    };
  }, [toastFn]);

  return <ToastComponent />;
}
