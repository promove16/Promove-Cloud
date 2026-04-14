import { Toaster as Sonner, toast } from 'sonner';
import { useSettings } from '../../../hooks/useSettings';
import { getStoredTheme } from '../../../hooks/useTheme';

export { toast };

export function Toaster() {
  const { settings } = useSettings();
  const theme = settings?.appearance?.theme ?? getStoredTheme();

  return (
    <Sonner
      closeButton
      richColors
      expand
      theme={theme === 'system' ? 'dark' : theme}
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl',
          title: 'text-sm font-semibold text-slate-50',
          description: 'text-sm text-slate-300',
          actionButton: 'bg-cyan-400 text-slate-950',
          cancelButton: 'bg-slate-800 text-slate-100',
          closeButton: 'border-slate-700 bg-slate-900 text-slate-300',
        },
      }}
    />
  );
}
