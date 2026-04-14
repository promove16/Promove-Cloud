import { type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export interface PortfolioSidebarItem {
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: "logout";
}

interface SidebarProps {
  roleLabel: string;
  roleDescription: string;
  items: PortfolioSidebarItem[];
  onLogout: () => void;
}

export function Sidebar({ roleLabel, roleDescription, items, onLogout }: SidebarProps) {
  const location = useLocation();

  const isPathActive = (itemPath?: string) => {
    if (!itemPath) {
      return false;
    }

    const currentSegments = location.pathname.split('/').filter(Boolean);
    const itemSegments = itemPath.split('/').filter(Boolean);

    if (itemSegments.length === 0) {
      return false;
    }

    const isExactMatch =
      currentSegments.length === itemSegments.length &&
      itemSegments.every((segment, index) => currentSegments[index] === segment);

    if (isExactMatch) {
      return true;
    }

    const isRoleWorkspaceRoot = itemSegments.length === 2 && itemSegments[0] === 'dashboard';
    if (isRoleWorkspaceRoot) {
      return false;
    }

    return (
      currentSegments.length > itemSegments.length &&
      itemSegments.every((segment, index) => currentSegments[index] === segment)
    );
  };

  return (
    <aside className="hidden w-72 shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:border-r lg:border-slate-800 lg:bg-slate-950 lg:p-6">
      <div className="rounded-sm border border-slate-700 bg-slate-900 p-4">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">ProMove</div>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">Innovation Cloud</h1>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = isPathActive(item.path);
          const className = `group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            isActive
              ? "bg-cyan-500/15 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          }`;

          if (item.action === "logout") {
            return (
              <button key={item.label} type="button" onClick={onLogout} className={className}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.label} to={item.path ?? "#"} className={className}>
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-sm border border-slate-700 bg-slate-900 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Active Role</div>
        <div className="mt-2 text-xl font-semibold text-slate-100">{roleLabel}</div>
        <p className="mt-2 text-sm leading-5 text-slate-400">{roleDescription}</p>
      </div>
    </aside>
  );
}


