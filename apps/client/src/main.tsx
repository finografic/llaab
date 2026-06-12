import '@llaab/ui/styles/globals.css';
import 'styles/app.css';
import { QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'components/ui/sonner';
import { queryClient } from 'providers/QueryClientProvider/queryClient';
import { RunMonitorProvider } from 'providers/RunMonitorProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <TanStackQueryClientProvider client={queryClient}>
      <RunMonitorProvider>
        <RouterProvider router={router} />
        <Toaster />
      </RunMonitorProvider>
    </TanStackQueryClientProvider>
  </StrictMode>,
);
