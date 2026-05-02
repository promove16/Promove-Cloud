import { NavLink, useLocation } from 'react-router-dom';
import {
  getOptionTabClassName,
  getOptionTabsListClassName,
} from '../../components/ui/OptionTabs';

export interface AdminSectionLink {
  label: string;
  shortLabel: string;
  description: string;
  path: string;
}

export const isAdminSectionActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export const getActiveAdminSection = <T extends AdminSectionLink>(
  pathname: string,
  links: ReadonlyArray<T>,
) =>
  links.find((link) => isAdminSectionActive(pathname, link.path)) ?? links[0];

export function AdminSectionTabs({
  links,
}: {
  links: ReadonlyArray<AdminSectionLink>;
}) {
  const location = useLocation();

  return (
    <div className="overflow-x-auto px-1">
      <div className={getOptionTabsListClassName()}>
        {links.map((link) => {
          const isActive = isAdminSectionActive(location.pathname, link.path);

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={getOptionTabClassName({ active: isActive })}
            >
              <span>{link.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
