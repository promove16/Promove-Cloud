import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  Rocket,
  Send,
  type LucideIcon,
} from "lucide-react";

export interface StartupLaunchSectionLink {
  label: string;
  shortLabel: string;
  description: string;
  segment: string;
  icon: LucideIcon;
  path?: string;
}

export const STARTUP_LAUNCH_BASE_PATH = "/startup-launch";
export const STARTUP_LAUNCH_LIST_PATH = STARTUP_LAUNCH_BASE_PATH;
export const STARTUP_LAUNCH_DRAFT_ID = "new";
export const STARTUP_LAUNCH_NEW_PATH = `${STARTUP_LAUNCH_BASE_PATH}/new`;
export const STARTUP_LAUNCH_LEGACY_NEW_OVERVIEW_PATH = `${STARTUP_LAUNCH_BASE_PATH}/new/overview`;

export const STARTUP_LAUNCH_SECTION_LINKS: StartupLaunchSectionLink[] = [
  {
    label: "Initialization",
    shortLabel: "Init",
    description: "Define your startup's vision, mission, business model, and core details",
    segment: "overview",
    icon: Rocket,
  },
  {
    label: "Workspace",
    shortLabel: "Workspace",
    description: "Collaborate with your team, share updates, and track progress",
    segment: "product-workspace",
    icon: FolderKanban,
  },
  {
    label: "Cap Table",
    shortLabel: "Cap Table",
    description: "Manage equity distribution, shares, and investor stakes",
    segment: "cap-table",
    icon: BarChart3,
  },
  {
    label: "Patent System",
    shortLabel: "Patents",
    description: "File for patent protection or request admin-assisted patents with tracking",
    segment: "patent-support",
    icon: FileText,
  },
  {
    label: "Investor Deals",
    shortLabel: "Deals",
    description: "Receive and manage investment offers from investors",
    segment: "investor-deals",
    icon: BriefcaseBusiness,
  },
  {
    label: "Investor Outreach",
    shortLabel: "Outreach",
    description: "Proactively reach out to investors and pitch your startup",
    segment: "investor-outreach",
    icon: Send,
  },
];

export const getStartupSectionPath = (startupId: string, segment: string) =>
  `${STARTUP_LAUNCH_BASE_PATH}/${startupId}/${segment}`;

export const getStartupOverviewPath = (startupId: string) =>
  getStartupSectionPath(startupId, "overview");

export const normalizeStartupRouteId = (startupId?: string) =>
  startupId && startupId !== STARTUP_LAUNCH_DRAFT_ID ? startupId : undefined;
