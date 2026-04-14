import { RouterProvider } from 'react-router-dom';
import { router } from '../pages';
import { AuthProvider } from './context/AuthContext';
import { useThemeInit } from '../hooks/useTheme';
import { Toaster } from './components/ui/sonner';

function ThemedApp() {
  useThemeInit();
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemedApp />
      <Toaster />
    </AuthProvider>
  );
}
