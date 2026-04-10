import { Bell } from "lucide-react";

interface HeaderProps {
  initials: string;
  organizationName: string;
}

export function Header({ initials, organizationName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-end gap-4 border-b border-slate-800 bg-slate-950 px-4 py-4 sm:px-6 lg:ml-72">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </button>
      <div className="inline-flex items-center gap-3 rounded-sm border border-slate-700 bg-slate-900 px-3 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
          {initials}
        </div>
        <span className="hidden rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 sm:inline-flex">
          {organizationName}
        </span>
      </div>
    </header>
  );
}

