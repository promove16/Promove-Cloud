import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';

type AuthPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  icon?: LucideIcon;
  wrapperClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
};

export function AuthPasswordField({
  label,
  icon: Icon,
  wrapperClassName,
  inputClassName,
  iconClassName,
  labelClassName,
  id,
  ...props
}: AuthPasswordFieldProps) {
  const generatedId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const inputId = id ?? generatedId;

  return (
    <div className={wrapperClassName}>
      {label ? (
        <label
          htmlFor={inputId}
          className={labelClassName ?? 'mb-3 block text-lg font-semibold text-white'}
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {Icon ? (
          <Icon
            className={
              iconClassName ??
              'pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400'
            }
          />
        ) : null}
        <input {...props} id={inputId} type={isVisible ? 'text' : 'password'} className={inputClassName} />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-white"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
