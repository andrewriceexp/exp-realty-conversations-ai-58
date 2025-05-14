
import { createRoot } from 'react-dom/client';
import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Make sure we have a valid DOM element to mount to
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element - check your HTML structure");
}

// Create root and render app with proper error handling
createRoot(rootElement).render(
  <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </Suspense>
);
