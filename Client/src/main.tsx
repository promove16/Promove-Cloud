import React from 'react';
import ReactDOM from 'react-dom/client';
// Apply stored theme before React mounts to avoid flash
(function () {
  const theme = localStorage.getItem('promove-theme') ?? 'dark';
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(dark ? 'dark' : 'light');
  } else {
    root.classList.add(theme === 'light' ? 'light' : 'dark');
  }
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
