import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

type AuthPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
  iconClassName?: string;
  toggleClassName?: string;
};

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  ({ className, containerClassName, iconClassName, toggleClassName, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const ToggleIcon = isVisible ? EyeOff : Eye;

    return (
      <div className={twMerge(clsx('relative', containerClassName))}>
        <Lock
          className={twMerge(
            clsx(
              'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400',
              iconClassName,
            ),
          )}
        />
        <input
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          className={twMerge(
            clsx(
              'w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-12 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none',
            ),
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className={twMerge(
            clsx(
              'absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus:text-slate-200',
              toggleClassName,
            ),
          )}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
        >
          <ToggleIcon className="h-5 w-5" />
        </button>
      </div>
    );
  },
);

AuthPasswordField.displayName = 'AuthPasswordField';
