
"use client";

import { Toaster as ToastComponent } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useToast, setToast } from "@/hooks/use-toast";

export function Toaster() {
  // Initialize the toast function when the component mounts
  const { toast } = useToast();
  
  useEffect(() => {
    console.log("[Toaster] Initializing global toast function");
    setToast(toast);
    
    // Test toast to verify initialization
    // Uncomment for debugging:
    // toast({
    //   title: "Toast Initialized",
    //   description: "Toast notification system is ready",
    //   variant: "default"
    // });
    
    return () => {
      // This is optional, but good practice for cleanup
      console.log("[Toaster] Cleaning up toast initialization");
    };
  }, [toast]);

  return <ToastComponent />;
}
