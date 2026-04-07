import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Briefcase, TrendingUp, CheckCircle2, Clock, XCircle, Handshake } from "lucide-react";
import { dealApi } from "../../../api/deal.api";
import { normalizeStartupRouteId } from "../../../features/startup/navigation";
import { DealSummaryView } from "../../../types/deal.types";

const stageLabels: Record<number, { label: string; description: string; color: string }> = {
  1: {
    label: "Stage 1",
    description: "Due diligence in progress",
    color: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  },
  2: {
    label: "Stage 2",
    description: "Fund transfer in progress",
    color: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
  },
  3: {
    label: "Stage 3",
    description: "Awaiting equity verification by admin",
    color: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20",
  },
  4: {
    label: "Stage 4",
    description: "Deal closed — check your portfolio!",
    color: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  },
};

function DealCard({
  deal,
  index,
  onRespond,
  responding,
}: {
  deal: DealSummaryView;
  index: number;
  onRespond: (decision: "accepted" | "rejected") => void;
  responding: boolean;
}) {
  const stage = stageLabels[deal.currentStage] ?? stageLabels[1];
  const investorName = deal.investorDisplayName || `Investor #${index + 1}`;
  const canRespond = deal.currentStage === 1 && deal.founderDecision.status === "pending" && deal.status === "active";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-blue-500/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{investorName}</h3>
          <p className="mt-0.5 text-sm text-slate-400">Startup: {deal.startupName}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${stage.color}`}>
          {stage.label}
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          {deal.currentStage === 4 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Clock className="h-4 w-4 text-blue-400" />
          )}
          {deal.nextActionLabel}
        </div>
        <p className="mt-2 text-xs text-slate-500">{stage.description}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
          <Handshake className="h-3.5 w-3.5 text-cyan-400" />
          Founder response: {deal.founderDecision.status}
        </div>
        {deal.founderDecision.note ? (
          <p className="mt-3 text-xs leading-5 text-slate-400">{deal.founderDecision.note}</p>
        ) : null}
        {deal.stockTransfer.reviewNotes ? (
          <p className="mt-3 text-xs leading-5 text-amber-300">Admin note: {deal.stockTransfer.reviewNotes}</p>
        ) : null}
        {canRespond ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond("accepted")}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept proposal
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond("rejected")}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Decline proposal
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {deal.currentStage >= 2 && deal.amountINR > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500 uppercase tracking-wider">Investment</div>
            <div className="mt-1 font-semibold text-white">₹{deal.amountINR.toLocaleString("en-IN")}</div>
          </div>
        ) : null}
        {deal.currentStage >= 3 && deal.equityPercent > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500 uppercase tracking-wider">Equity</div>
            <div className="mt-1 font-semibold text-white">{deal.equityPercent}%</div>
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase tracking-wider">Category</div>
          <div className="mt-1 font-semibold text-white capitalize">{deal.startupCategory}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase tracking-wider">Investor Type</div>
          <div className="mt-1 font-semibold capitalize text-white">{deal.investorType}</div>
        </div>
      </div>
    </div>
  );
}

export function StudentInvestorDeals() {
  const { startupId } = useParams<{ startupId?: string }>();
  const normalizedStartupId = normalizeStartupRouteId(startupId);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["student", "active-deals"],
    queryFn: dealApi.getMyDeals,
    refetchInterval: 60_000,
  });
  const respondMutation = useMutation({
    mutationFn: ({ dealId, decision }: { dealId: string; decision: "accepted" | "rejected" }) =>
      dealApi.respondToFounderDecision(dealId, { decision }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["student", "active-deals"] });
    },
  });

  const deals = data?.items ?? [];
  const scopedDeals = useMemo(
    () =>
      normalizedStartupId ? deals.filter((deal) => deal.startupId === normalizedStartupId) : deals,
    [deals, normalizedStartupId],
  );
  const activeDeals = scopedDeals.filter((d) => d.status === "active");
  const closedDeals = scopedDeals.filter((d) => d.status !== "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Investor Deals</h1>
        <p className="mt-2 text-slate-400">
          Monitor the status of your investor deal flow across all stages.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Deals", count: scopedDeals.length, color: "text-white" },
          { label: "Active", count: activeDeals.length, color: "text-blue-400" },
          { label: "Closed", count: closedDeals.length, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center text-slate-400">
          Loading deals...
        </div>
      ) : scopedDeals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
          <Briefcase className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <h3 className="mb-2 text-lg font-semibold text-white">
            {normalizedStartupId ? "No investor deals for this startup yet" : "No investor deals yet"}
          </h3>
          <p className="text-slate-400">
            {normalizedStartupId
              ? "Launch this startup to investors from the Startup Launch engine to begin deal flow."
              : "Launch your startup to investors from the Startup Launch engine to begin deal flow."}
          </p>
        </div>
      ) : (
        <>
          {activeDeals.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Active Deals</h2>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {activeDeals.map((deal, i) => (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    index={i}
                    responding={respondMutation.isPending && respondMutation.variables?.dealId === deal._id}
                    onRespond={(decision) => respondMutation.mutate({ dealId: deal._id, decision })}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {closedDeals.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Closed Deals</h2>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {closedDeals.map((deal, i) => (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    index={i}
                    responding={false}
                    onRespond={() => undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
