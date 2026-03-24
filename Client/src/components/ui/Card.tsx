import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx('rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/20'),
        className,
      )}
      {...props}
    />
  );
}
