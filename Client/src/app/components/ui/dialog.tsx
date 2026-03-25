import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { cn } from './utils';

type DialogContextValue = {
  onOpenChange?: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return <DialogContext.Provider value={{ onOpenChange }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ ...props }: HTMLAttributes<HTMLButtonElement>) {
  return <button {...props} />;
}

function DialogPortal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function DialogClose({ className, children, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const context = useContext(DialogContext);

  return (
    <button
      type="button"
      className={cn('inline-flex items-center justify-center', className)}
      onClick={() => context?.onOpenChange?.(false)}
      {...props}
    >
      {children ?? <XIcon className="h-4 w-4" />}
    </button>
  );
}

function DialogOverlay({
  className,
  onClick,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const context = useContext(DialogContext);

  return (
    <div
      className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.target === event.currentTarget) {
          context?.onOpenChange?.(false);
        }
      }}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl shadow-black/40 sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogClose className="absolute right-4 top-4 rounded-full border border-slate-700 p-2 text-slate-400 hover:text-white" />
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-slate-400', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
