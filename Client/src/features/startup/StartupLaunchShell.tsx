import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "../../app/components/DashboardLayout";
import { startupApi } from "../../api/startup.api";
import { StartupSectionTabs } from "./StartupSectionTabs";
import {
  STARTUP_LAUNCH_LIST_PATH,
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0 });
    }
  }, [location.pathname]);

  return (
    <DashboardLayout role="student">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-1 pb-3">
          <button
            onClick={() => navigate(STARTUP_LAUNCH_LIST_PATH)}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All Startups
          </button>

          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <span
              className={`border px-2.5 py-1 ${isLocked ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-800 bg-slate-900 text-slate-300"}`}
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

        <Outlet context={{ startupId }} />
      </div>
    </DashboardLayout>
  );
}
