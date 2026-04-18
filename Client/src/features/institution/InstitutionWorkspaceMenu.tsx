import {
  FolderKanban,
  KeyRound,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  getOptionTabClassName,
  getOptionTabsListClassName,
} from "../../components/ui/OptionTabs";

type InstitutionWorkspaceMode = "school" | "college";

type WorkspaceMenuItem = {
  label: string;
  path: string;
  icon: typeof Users;
};

const INSTITUTION_WORKSPACE_ITEMS: Record<
  InstitutionWorkspaceMode,
  WorkspaceMenuItem[]
> = {
  school: [
    {
      label: "Student Innovators",
      path: "/dashboard/school/students",
      icon: Users,
    },
    {
      label: "Roster & Onboarding",
      path: "/dashboard/school/operations",
      icon: KeyRound,
    },
    {
      label: "Innovation Pipeline",
      path: "/dashboard/school/projects",
      icon: FolderKanban,
    },
  ],
  college: [
    {
      label: "Student Innovators",
      path: "/dashboard/college/students",
      icon: Users,
    },
    {
      label: "Roster & Onboarding",
      path: "/dashboard/college/operations",
      icon: KeyRound,
    },
    {
      label: "Innovation Pipeline",
      path: "/dashboard/college/projects",
      icon: FolderKanban,
    },
  ],
};

const isPathMatch = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export function InstitutionWorkspaceMenu({
  mode,
  className,
}: {
  mode: InstitutionWorkspaceMode;
  className?: string;
}) {
  const location = useLocation();
  const items = INSTITUTION_WORKSPACE_ITEMS[mode];

  return (
    <div className={className}>
      <div className={getOptionTabsListClassName()}>
        {items.map((item) => {
          const isActive = isPathMatch(location.pathname, item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={getOptionTabClassName({ active: isActive })}
            >
              <span
                className={
                  isActive
                    ? "text-cyan-300"
                    : "text-slate-500 group-hover:text-slate-300"
                }
              >
                <item.icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
