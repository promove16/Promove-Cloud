import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  Rocket,
  Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "../../app/components/DashboardLayout";
import { startupApi } from "../../api/startup.api";
import { StartupSectionTabs } from "./StartupSectionTabs";
import {
  getStartupSectionPath,
  STARTUP_LAUNCH_LIST_PATH,
  STARTUP_LAUNCH_SECTION_LINKS,
} from "./navigation";

type SectionAction = {
  label: string;
  onClick: () => void;
  icon: typeof Rocket;
  tone?: "primary" | "secondary";
  disabled?: boolean;
};

export function StartupLaunchShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startupId } = useParams<{ startupId: string }>();
  const startupQuery = useQuery({
    queryKey: ["startup", startupId],
    queryFn: () => startupApi.getById(startupId!),
    enabled: Boolean(startupId),
  });
  const startup = startupQuery.data;
  const isLocked = Boolean(startup?.editAccess?.isLocked);
  const activeSection =
    STARTUP_LAUNCH_SECTION_LINKS.find((section) => {
      const path = getStartupSectionPath(startupId ?? "", section.segment);
      return (
        location.pathname === path || location.pathname.startsWith(`${path}/`)
      );
    }) ?? STARTUP_LAUNCH_SECTION_LINKS[0];

  const startupName = startup?.name?.trim() || "this startup";
  const sectionSupportText: Record<string, string> = {
    overview:
      "This is the founder control center. Use it to keep the startup profile launch-ready and move only the supporting work into the specialist tabs.",
    "investor-outreach":
      "This tab exists to actively drive fundraising. It should help the founder shortlist investors, send pitches, and move conversations toward formal deals.",
    "product-workspace":
      "This tab is intentionally a startup-to-workspace control panel, not the full builder. Its job is to attach one operating workspace to the startup and keep execution ownership clean.",
    "cap-table":
      "This page is the ownership record. It stays separate because equity, investor classes, and retained founder shares need tighter governance than normal workspace activity.",
    "investor-deals":
      "This tab tracks live deal progression after outreach starts working. It gives the founder one place to review negotiations, workshop links, and closed outcomes.",
    "patent-support":
      "This tab exists for IP intake and filing readiness. It stays separate so startup evidence, patent answers, and admin review remain attached to the correct startup workspace.",
  };

  const sectionActions: Record<string, SectionAction[]> = {
    overview: [
      {
        label: "Open Outreach",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "investor-outreach")),
        icon: Send,
        tone: "primary",
      },
      {
        label: startup?.projectId ? "Open Linked Workspace" : "Link Workspace",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "product-workspace")),
        icon: FolderKanban,
        tone: "secondary",
      },
    ],
    "investor-outreach": [
      {
        label: "Open Deals",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "investor-deals")),
        icon: BriefcaseBusiness,
        tone: "primary",
      },
      {
        label: "Back to Launch",
        onClick: () => navigate(getStartupSectionPath(startupId ?? "", "overview")),
        icon: Rocket,
        tone: "secondary",
      },
    ],
    "product-workspace": [
      {
        label: startup?.projectId ? "Open Full Workspace" : "Link Workspace",
        onClick: () =>
          startup?.projectId
            ? navigate(`/product-workspace/${startup.projectId}`)
            : navigate(getStartupSectionPath(startupId ?? "", "product-workspace")),
        icon: FolderKanban,
        tone: "primary",
      },
      {
        label: "Open Patent Support",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "patent-support")),
        icon: FileText,
        tone: "secondary",
      },
    ],
    "cap-table": [
      {
        label: "Open Deals",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "investor-deals")),
        icon: BriefcaseBusiness,
        tone: "primary",
      },
      {
        label: "Back to Launch",
        onClick: () => navigate(getStartupSectionPath(startupId ?? "", "overview")),
        icon: Rocket,
        tone: "secondary",
      },
    ],
    "investor-deals": [
      {
        label: "Open Outreach",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "investor-outreach")),
        icon: Send,
        tone: "primary",
      },
      {
        label: "Open Cap Table",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "cap-table")),
        icon: BriefcaseBusiness,
        tone: "secondary",
      },
    ],
    "patent-support": [
      {
        label: startup?.projectId ? "Open Linked Workspace" : "Link Workspace",
        onClick: () =>
          navigate(getStartupSectionPath(startupId ?? "", "product-workspace")),
        icon: FolderKanban,
        tone: "primary",
      },
      {
        label: "Back to Launch",
        onClick: () => navigate(getStartupSectionPath(startupId ?? "", "overview")),
        icon: Rocket,
        tone: "secondary",
      },
    ],
  };
  const actions = sectionActions[activeSection.segment] ?? [];

  return (
    <DashboardLayout role="student">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 px-1 pb-3">
          <button
            onClick={() => navigate(STARTUP_LAUNCH_LIST_PATH)}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All Startups
          </button>

          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <span
              className={`border px-2.5 py-1 ${isLocked ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-800 bg-slate-900/80 text-slate-300"}`}
            >
              Saved Startup
            </span>
            <span className="hidden sm:inline">
              {isLocked
                ? "Profile sections locked"
                : "Profile sections unlocked"}
            </span>
          </div>
        </div>

        <StartupSectionTabs />

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                {activeSection.label}
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {activeSection.label} for {startupName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {activeSection.description}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {sectionSupportText[activeSection.segment]}
              </p>
            </div>

            <div className="min-w-0 space-y-3 lg:w-[24rem]">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Why This Tab Exists
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {activeSection.segment === "product-workspace"
                    ? "Use this page to control the startup's linked execution workspace, then jump into the full workspace only when you need to do the actual build work."
                    : activeSection.segment === "cap-table"
                      ? "Use this page when you need ownership clarity, not day-to-day execution updates."
                      : activeSection.segment === "investor-deals"
                        ? "Use this page after investor interest begins, when deal tracking matters more than profile editing."
                        : activeSection.segment === "patent-support"
                          ? "Use this page when the startup is ready to package invention evidence and request IP review."
                          : activeSection.segment === "investor-outreach"
                            ? "Use this page when the founder is actively trying to create investor conversations."
                            : "Use this page to keep the startup launch workflow complete and ready for the next step."}
                </p>
              </div>

              {actions.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                          action.tone === "primary"
                            ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-500/15"
                            : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <Outlet context={{ startupId }} />
      </div>
    </DashboardLayout>
  );
}
