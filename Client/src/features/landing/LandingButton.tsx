import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

type Variant = 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface LandingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-heading font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20',
  outline: 'border border-border/60 bg-transparent text-foreground hover:bg-muted/40',
  ghost: 'bg-transparent text-foreground hover:bg-muted/40',
  secondary: 'bg-muted text-foreground hover:bg-muted/80',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-full px-4 text-xs',
  md: 'h-10 rounded-full px-5 text-sm',
  lg: 'h-12 rounded-full px-6 text-base',
  icon: 'h-10 w-10 rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, LandingButtonProps>(function LandingButton(
  { className, variant = 'default', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={twMerge(clsx(base, variants[variant], sizes[size]), className)}
      {...props}
    />
  );
});

export default Button;
