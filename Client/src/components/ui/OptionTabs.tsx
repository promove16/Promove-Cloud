import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface OptionTabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface OptionTabsProps<T extends string> {
  items: ReadonlyArray<OptionTabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
  className?: string;
  listClassName?: string;
  stretch?: boolean;
}

export const getOptionTabsListClassName = ({
  stretch = false,
  className,
}: {
  stretch?: boolean;
  className?: string;
} = {}) =>
  twMerge(
    clsx(
      'flex min-w-max items-stretch gap-2 border-b border-slate-200 dark:border-slate-800',
      stretch && 'min-w-0 w-full gap-0',
    ),
    className,
  );

export const getOptionTabClassName = ({
  active,
  stretch = false,
}: {
  active: boolean;
  stretch?: boolean;
}) =>
  twMerge(
    clsx(
      'group relative inline-flex min-h-[3rem] items-center gap-2.5 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
      stretch ? 'min-w-0 flex-1 justify-center px-3 text-center' : 'shrink-0',
      active
        ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-300'
        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:hover:border-slate-700 dark:hover:text-slate-200',
    ),
  );

export function OptionTabs<T extends string>({
  items,
  activeId,
  onChange,
  className,
  listClassName,
  stretch = false,
  'aria-label': ariaLabel = 'Section navigation',
}: OptionTabsProps<T>) {
  return (
    <div className={twMerge(clsx('overflow-x-auto', className))}>
      <div className={getOptionTabsListClassName({ stretch, className: listClassName })} role="tablist" aria-label={ariaLabel}>
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = id === activeId;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={getOptionTabClassName({ active: isActive, stretch })}
            >
              {Icon ? (
                <span className={clsx('transition-colors', isActive ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-300')}>
                  <Icon className="h-4 w-4" />
                </span>
              ) : null}
              <span className={clsx(stretch && 'truncate')}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
