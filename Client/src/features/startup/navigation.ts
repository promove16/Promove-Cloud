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
    label: "Launch",
    shortLabel: "Launch",
    description:
      "Build the startup profile, pass admin review, and launch to investors or mentors.",
    segment: "overview",
    icon: Rocket,
  },
  {
    label: "Investor Outreach",
    shortLabel: "Outreach",
    description:
      "Founder-managed investor shortlisting, pitch requests, and fundraising conversations.",
    segment: "investor-outreach",
    icon: Send,
  },
  {
    label: "Product Workspace",
    shortLabel: "Workspace",
    description:
      "Link a dedicated product workspace to this startup and review the founder team synced from it.",
    segment: "product-workspace",
    icon: FolderKanban,
  },
  {
    label: "Cap Table",
    shortLabel: "Cap Table",
    description:
      "Founder-managed retained equity, sole investor allocation, and penny investor shares.",
    segment: "cap-table",
    icon: BarChart3,
  },
  {
    label: "Investors Deals",
    shortLabel: "Investors Deals",
    description:
      "Monitor live investor deal flow, stages, and closed outcomes in one place.",
    segment: "investor-deals",
    icon: BriefcaseBusiness,
  },
  {
    label: "Patent Support",
    shortLabel: "Patent Support",
    description: "Request patent support for startups that need IP protection.",
    segment: "patent-support",
    icon: FileText,
  },
];

export const getStartupSectionPath = (startupId: string, segment: string) =>
  `${STARTUP_LAUNCH_BASE_PATH}/${startupId}/${segment}`;

export const getStartupOverviewPath = (startupId: string) =>
  getStartupSectionPath(startupId, "overview");

export const normalizeStartupRouteId = (startupId?: string) =>
  startupId && startupId !== STARTUP_LAUNCH_DRAFT_ID ? startupId : undefined;
