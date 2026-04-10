import { CalendarDays, GraduationCap, Settings2, Users } from "lucide-react";
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
      label: "Mentorship",
      path: "/dashboard/school/mentors",
      icon: GraduationCap,
    },
    {
      label: "Operations",
      path: "/dashboard/school/operations",
      icon: Settings2,
    },
    { label: "Events", path: "/dashboard/school/events", icon: CalendarDays },
  ],
  college: [
    {
      label: "Student Innovators",
      path: "/dashboard/college/students",
      icon: Users,
    },
    {
      label: "Mentorship",
      path: "/dashboard/college/mentors",
      icon: GraduationCap,
    },
    {
      label: "Student Tokens",
      path: "/dashboard/college/operations",
      icon: Settings2,
    },
    { label: "Events", path: "/dashboard/college/events", icon: CalendarDays },
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
