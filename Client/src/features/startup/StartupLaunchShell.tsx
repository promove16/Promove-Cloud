import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "../../app/components/DashboardLayout";
import { startupApi } from "../../api/startup.api";
import { StartupSectionTabs } from "./StartupSectionTabs";
import {
  getStartupSectionPath,
  STARTUP_LAUNCH_LIST_PATH,
  STARTUP_LAUNCH_SECTION_LINKS,
} from "./navigation";

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

  const startupName = startup?.name?.trim() || "Startup";

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
          <div className="flex flex-col gap-2">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                {activeSection.label}
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {startupName}
              </h1>
            </div>
          </div>
        </div>

        <Outlet context={{ startupId }} />
      </div>
    </DashboardLayout>
  );
}
