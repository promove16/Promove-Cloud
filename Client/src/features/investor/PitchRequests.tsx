import { useQuery } from "@tanstack/react-query";
import { MessageSquare, ArrowRight, Clock, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { startupApi } from "../../api/startup.api";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InvestorWorkspaceLayout } from "./InvestorWorkspaceLayout";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-400" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "text-emerald-400" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-400" },
  withdrawn: { label: "Withdrawn", icon: XCircle, color: "text-slate-400" },
};

export default function InvestorPitchRequests() {
  const { data: pitchRequests, isLoading } = useQuery({
    queryKey: ["investor", "pitch-requests"],
    queryFn: startupApi.getPitchRequests,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const pendingRequests = pitchRequests?.filter(r => r.status === "pending") ?? [];
  const respondedRequests = pitchRequests?.filter(r => r.status !== "pending") ?? [];

  return (
    <InvestorWorkspaceLayout
      title="Pitch Requests"
      description="Startups that have sent you direct investor outreach."
      contentClassName="mx-auto w-full max-w-5xl space-y-6"
    >

      {pitchRequests?.length === 0 ? (
        <Card className="border-slate-800 bg-slate-950 p-12 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-lg font-semibold text-white">No Pitch Requests Yet</h3>
          <p className="text-slate-400 mt-2">
            When students send you direct investor outreach, they will appear here.
            Browse the startup marketplace to discover new opportunities.
          </p>
          <Link
            to="/dashboard/investor/startups"
            className="mt-4 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            Browse Startups <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      ) : (
        <>
          {pendingRequests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                Pending Requests ({pendingRequests.length})
              </h2>
              <div className="grid gap-4">
                {pendingRequests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;

                  return (
                    <Card
                      key={request._id}
                      className="border-slate-800 bg-slate-950 p-4 transition hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white">{request.startupName}</h3>
                            <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{request.startupTagline}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{request.startupCategory}</span>
                            <span>{request.startupStage}</span>
                            <span>
                              Requested {new Date(request.requestedAt).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                        </div>
                        <Link
                          to={`/dashboard/investor/startups`}
                          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition"
                        >
                          View Startup
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {respondedRequests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Previous Requests</h2>
              <div className="grid gap-4">
                {respondedRequests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;

                  return (
                    <Card
                      key={request._id}
                      className="border-slate-800 bg-slate-950 p-4 opacity-70"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white">{request.startupName}</h3>
                            <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{request.startupTagline}</p>
                          {request.responseNote && (
                            <p className="text-xs text-slate-500 mt-2 italic">
                              "{request.responseNote}"
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {request.respondedAt && new Date(request.respondedAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </InvestorWorkspaceLayout>
  );
}
