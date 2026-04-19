import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20',
        ),
        className,
      )}
      {...props}
    />
  );
}
