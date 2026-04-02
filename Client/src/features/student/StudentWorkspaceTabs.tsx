import clsx from "clsx";
import { NavLink, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { STUDENT_SECTION_LINKS, isStudentSectionActive } from "./studentNavigation";

interface StudentWorkspaceTabsProps {
  className?: string;
}

export function StudentWorkspaceTabs({ className }: StudentWorkspaceTabsProps) {
  const location = useLocation();

  return (
    <div className={twMerge(clsx("overflow-x-auto", className))}>
      <div className="flex min-w-max items-center gap-8 border-b border-slate-800/90">
        {STUDENT_SECTION_LINKS.map((link) => {
          const isActive = isStudentSectionActive(location.pathname, link);

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={twMerge(
                clsx(
                  "inline-flex min-h-[3rem] items-center border-b-2 border-transparent px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-cyan-400 text-cyan-300"
                    : "text-slate-400 hover:border-slate-700 hover:text-slate-100",
                ),
              )}
            >
              {link.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
