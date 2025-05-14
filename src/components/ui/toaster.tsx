
"use client";

import { Toaster as ToastComponent } from "@/hooks/use-toast";
import { useEffect } from "react";
import { setToast, useToast } from "@/hooks/use-toast";

export function Toaster() {
  // Initialize the toast function when the component mounts
  const { toast } = useToast();
  
  useEffect(() => {
    setToast(toast);
  }, [toast]);

  return <ToastComponent />;
}
