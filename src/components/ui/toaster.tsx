
"use client";

import { Toaster as ToastComponent } from "@/hooks/use-toast";
import { useEffect } from "react";
import { initializeToast } from "@/hooks/toast-utils";

export function Toaster() {
  // Initialize the toast function when the component mounts
  useEffect(() => {
    initializeToast();
  }, []);

  return <ToastComponent />;
}
