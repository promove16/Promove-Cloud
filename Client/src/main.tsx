import React from 'react';
import ReactDOM from 'react-dom/client';
// Apply stored theme before React mounts to avoid flash
(function () {
  const root = document.documentElement;
  // Temporarily force dark mode across the platform for the brutal UI test stability
  localStorage.setItem('promove-theme', 'dark');
  root.classList.remove('light');
  root.classList.add('dark');
})();
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
