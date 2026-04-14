import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Briefcase,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Handshake,
  Link2,
  X,
  Loader2,
} from "lucide-react";
import { dealApi } from "../../../api/deal.api";
import { workspaceApi } from "../../../api/workspace.api";
import { normalizeStartupRouteId } from "../../../features/startup/navigation";
import { DealSummaryView } from "../../../types/deal.types";
import { StudentNegotiationCard } from "./StudentNegotiationCard";

const stageLabels: Record<number, { label: string; description: string; color: string }> = {
  0: {
    label: "Stage 0",
    description: "Negotiating terms with investor",
    color: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  },
  1: {
    label: "Stage 1",
    description: "Due diligence in progress",
    color: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  },
  2: {
    label: "Stage 2",
    description: "Payment placeholder pending",
    color: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
  },
  3: {
    label: "Stage 3",
    description: "Awaiting equity verification by admin",
    color: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20",
  },
  4: {
    label: "Stage 4",
    description: "Deal closed - check your portfolio!",
    color: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  },
};

function LinkWorkspaceButton({
  dealId,
  deal,
  onLink,
  linkMutation,
}: {
  dealId: string;
  deal: DealSummaryView;
  onLink: (workspaceId: string) => void;
  linkMutation: { isPending: boolean; variables?: { dealId: string; workspaceId: string } };
}) {
  const [showModal, setShowModal] = useState(false);
  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaces = (workspacesQuery.data ?? []).filter(
    (workspace) =>
      workspace.isActive &&
      (String(workspace.ownerId) === deal.studentId ||
        (workspace.teamMemberIds ?? []).some((id) => String(id) === deal.studentId)),
  );

  const isLinkingThis = linkMutation.isPending && linkMutation.variables?.dealId === dealId;
  const linkedWorkspaceId = deal.productWorkshop?.workspaceId;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isLinkingThis || workspaces.length === 0}
        className="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {linkedWorkspaceId ? "Change Workshop" : isLinkingThis ? "Linking..." : "Link Workshop"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Link Product Workshop</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Select a workspace to link to this deal. Investors will see the workshop in their Product Workshop view.
            </p>
            {workspacesQuery.isLoading ? (
              <div className="py-4 text-center text-sm text-slate-400">Loading workspaces...</div>
            ) : workspaces.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-400">
                No active workspaces found. Create one from the Problem Bank first.
              </div>
            ) : (
              <div className="space-y-2">
                {workspaces.map((workspace) => {
                  const isLinked = workspace._id === linkedWorkspaceId;
                  const isLinking =
                    isLinkingThis && linkMutation.variables?.workspaceId === workspace._id;

                  return (
                    <button
                      key={workspace._id}
                      type="button"
                      onClick={() => {
                        onLink(workspace._id);
                        setShowModal(false);
                      }}
                      disabled={isLinked || isLinking}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isLinked
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">{workspace.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {workspace.category} | {workspace.progressPercent ?? 0}% complete
                          </div>
                        </div>
                        {isLinked ? (
                          <span className="text-xs font-semibold text-emerald-400">Linked</span>
                        ) : isLinking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DealCard({
  deal,
  index,
  onRespond,
  responding,
  onLinkWorkshop,
  linkMutation,
}: {
  deal: DealSummaryView;
  index: number;
  onRespond: (decision: "accepted" | "rejected") => void;
  responding: boolean;
  onLinkWorkshop: (workspaceId: string) => void;
  linkMutation: { isPending: boolean; variables?: { dealId: string; workspaceId: string } };
}) {
  const stage = stageLabels[deal.currentStage] ?? stageLabels[1];
  const investorName = deal.investorDisplayName || `Investor #${index + 1}`;
  const canRespond =
    deal.currentStage === 1 &&
    deal.founderDecision.status === "pending" &&
    deal.status === "active";
  const hasLinkedWorkshop = Boolean(deal.productWorkshop);

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
          <p className="mt-3 text-xs leading-5 text-amber-300">
            Admin note: {deal.stockTransfer.reviewNotes}
          </p>
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
            <div className="mt-1 font-semibold text-white">
              INR {deal.amountINR.toLocaleString("en-IN")}
            </div>
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

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Product Workshop
            </span>
          </div>
          {hasLinkedWorkshop ? (
            <span className="text-xs font-semibold text-emerald-400">Linked</span>
          ) : (
            <span className="text-xs text-slate-500">Not linked</span>
          )}
        </div>
        {hasLinkedWorkshop && deal.productWorkshop ? (
          <div className="mt-2">
            <div className="text-xs text-white">{deal.productWorkshop.title}</div>
            <div className="mt-1 text-xs text-slate-500">
              {deal.productWorkshop.progressPercent}% complete
            </div>
          </div>
        ) : null}
        {deal.status === "active" && deal.currentStage >= 2 ? (
          <div className="mt-3">
            <LinkWorkspaceButton
              dealId={deal._id}
              deal={deal}
              onLink={onLinkWorkshop}
              linkMutation={linkMutation}
            />
          </div>
        ) : null}
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
  const linkWorkshopMutation = useMutation({
    mutationFn: ({ dealId, workspaceId }: { dealId: string; workspaceId: string }) =>
      dealApi.linkWorkshopToDeal(dealId, workspaceId),
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
  const activeDeals = scopedDeals.filter((deal) => deal.status === "active");
  const closedDeals = scopedDeals.filter((deal) => deal.status !== "active");

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
          {activeDeals.filter(d => d.currentStage === 0).length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Negotiation</h2>
                <Handshake className="h-4 w-4 text-amber-400" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {activeDeals
                  .filter(d => d.currentStage === 0)
                  .map((deal, index) => (
                    <StudentNegotiationCard
                      key={deal._id}
                      deal={deal}
                      investorIndex={index}
                    />
                  ))}
              </div>
            </section>
          )}

          {activeDeals.filter(d => d.currentStage > 0).length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Active Deals</h2>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {activeDeals
                  .filter(d => d.currentStage > 0)
                  .map((deal, index) => (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    index={index}
                    responding={
                      respondMutation.isPending && respondMutation.variables?.dealId === deal._id
                    }
                    onRespond={(decision) =>
                      respondMutation.mutate({ dealId: deal._id, decision })
                    }
                    onLinkWorkshop={(workspaceId) =>
                      linkWorkshopMutation.mutate({ dealId: deal._id, workspaceId })
                    }
                    linkMutation={{
                      isPending: linkWorkshopMutation.isPending,
                      variables: linkWorkshopMutation.variables,
                    }}
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
                {closedDeals.map((deal, index) => (
                  <DealCard
                    key={deal._id}
                    deal={deal}
                    index={index}
                    responding={false}
                    onRespond={() => undefined}
                    onLinkWorkshop={() => undefined}
                    linkMutation={{ isPending: false, variables: undefined }}
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
