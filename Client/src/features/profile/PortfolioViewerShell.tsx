import { type ReactNode } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function PortfolioViewerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-800 bg-slate-900/90 p-5 text-slate-100 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function PortfolioViewerEmpty({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-700 bg-slate-950/70 px-5 py-4 text-sm text-slate-400 sm:px-6">
      {children}
    </div>
  );
}

export function PortfolioViewerStatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[20px] border border-slate-800 bg-slate-950/70 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export function PortfolioViewerSidebarRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-800 bg-slate-950/70 px-5 py-3.5">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

export function PortfolioViewerActionButton({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "inline-flex items-center gap-2 rounded-full border border-cyan-400/70 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-100";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function PortfolioViewerPageShell({
  backTo,
  canMessage,
  onMessage,
  loading,
  loadingLabel,
  error,
  errorLabel,
  children,
}: {
  backTo: string;
  canMessage?: boolean;
  onMessage?: () => void;
  loading?: boolean;
  loadingLabel: string;
  error?: boolean;
  errorLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-6 text-slate-100 sm:px-5 lg:-mx-8 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[96rem] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          {canMessage && onMessage ? (
            <button
              type="button"
              onClick={onMessage}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/90 px-6 py-8 text-sm text-slate-400">
            {loadingLabel}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-sm text-rose-100">
            {errorLabel}
          </div>
        ) : null}

        {!loading && !error ? children : null}
      </div>
    </div>
  );
}

export function PortfolioViewerHero({
  cover,
  avatar,
  title,
  badges,
  subtitle,
  description,
  meta,
  actions,
  aside,
}: {
  cover: ReactNode;
  avatar: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="w-full rounded-[28px] border border-slate-800 bg-slate-900/90 shadow-sm">
      <div className="relative">
        {cover}
        <div className="pointer-events-none absolute bottom-0 left-6 z-10 translate-y-1/2 sm:left-8">
          {avatar}
        </div>
      </div>

      <div className="px-6 pb-7 pt-16 sm:px-8 sm:pb-8 sm:pt-24 lg:px-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
                {title}
              </h1>
              {badges}
            </div>
            {subtitle ? <div className="mt-2 text-base text-slate-200">{subtitle}</div> : null}
            {description ? (
              <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</div>
            ) : null}
            {meta ? <div className="mt-4">{meta}</div> : null}
            {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
          </div>

          {aside ? <div className="min-w-[240px] text-sm">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}
