import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

type DashboardSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

type MetricRailItem = {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: LucideIcon;
  toneClassName?: string;
  cardClassName?: string;
};

type DashboardMetricRailProps = {
  items: MetricRailItem[];
  columnsClassName: string;
};

export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`border-t border-slate-800 pt-6 ${className}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function DashboardMetricRail({
  items,
  columnsClassName,
}: DashboardMetricRailProps) {
  return (
    <div className={`grid gap-4 border-y border-slate-800 py-5 ${columnsClassName}`}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`space-y-3 ${item.cardClassName ? `border px-4 py-4 ${item.cardClassName}` : ''} ${
            index > 0 ? 'md:border-l md:border-slate-800 md:pl-5' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-800">
              <item.icon className={`h-4 w-4 ${item.toneClassName ?? 'text-cyan-300'}`} />
            </div>
            <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{item.label}</div>
          </div>
          <div className="text-3xl font-semibold text-white">{item.value}</div>
          {item.helper ? <div className="text-sm text-slate-400">{item.helper}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function DashboardRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-slate-800 py-4 last:border-b-0 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DashboardEmpty({ message }: { message: string }) {
  return <div className="py-6 text-sm text-slate-500">{message}</div>;
}
