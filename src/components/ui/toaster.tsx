
"use client";

import {
  Toaster as RadixToaster,
} from "@/components/ui/toast";
import { useEffect } from "react";
import { initializeToast } from "@/hooks/toast-utils";

export function Toaster() {
  // Initialize the toast function when the component mounts
  useEffect(() => {
    initializeToast();
  }, []);

  return <RadixToaster />;
}
