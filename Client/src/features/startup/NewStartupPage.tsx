import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DashboardLayout } from "../../app/components/DashboardLayout";
import { StartupLaunch } from "../../app/pages/StartupLaunch";
import { STARTUP_LAUNCH_LIST_PATH } from "./navigation";

export function NewStartupPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout role="student">
      <div className="mx-auto w-full max-w-[96rem] space-y-4">
        <button
          onClick={() => navigate(STARTUP_LAUNCH_LIST_PATH)}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All Startups
        </button>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4 text-sm text-cyan-50">
          Promote a claimed Problem Bank workspace into this startup draft from the intake below, or leave it blank and start a fresh launch profile.
        </div>

        <StartupLaunch />
      </div>
    </DashboardLayout>
  );
}
