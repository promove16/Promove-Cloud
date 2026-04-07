import { NavLink, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import {
  getOptionTabClassName,
  getOptionTabsListClassName,
} from "../../components/ui/OptionTabs";
import {
  getStartupSectionPath,
  STARTUP_LAUNCH_SECTION_LINKS,
} from "./navigation";

interface StartupSectionTabsProps {
  className?: string;
}

export function StartupSectionTabs({ className }: StartupSectionTabsProps) {
  const location = useLocation();
  const { startupId } = useParams<{ startupId: string }>();
  const id = startupId ?? "";

  return (
    <div className={twMerge(clsx("overflow-x-auto", className))}>
      <div className={getOptionTabsListClassName()}>
        {STARTUP_LAUNCH_SECTION_LINKS.map((section) => {
          const path =
            section.path ?? getStartupSectionPath(id, section.segment);
          const isActive =
            location.pathname === path ||
            location.pathname.startsWith(`${path}/`);
          const Icon = section.icon;

          return (
            <NavLink
              key={section.segment}
              to={path}
              className={getOptionTabClassName({ active: isActive })}
            >
              <span
                className={
                  isActive
                    ? "text-cyan-300"
                    : "text-slate-500 group-hover:text-slate-300"
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{section.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
