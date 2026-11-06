import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { TestEnvBanner } from '../shared/ui/TestEnvBanner';
import { queryClient } from './query-client';
import { router } from './router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TestEnvBanner />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
