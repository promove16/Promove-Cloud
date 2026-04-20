import { useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { DirectoryInvestor } from "../../types/school.types";
import { getUserPortfolioViewPath } from "../marketplace/navigation";
import { InstitutionWorkspaceHeader } from "./InstitutionWorkspaceHeader";

type Props = {
  mode: "school" | "college";
  title: string;
  subtitle: string;
  queryKey: string;
  fetchInvestors: () => Promise<DirectoryInvestor[]>;
};

export function InvestorDirectoryBase({
  mode,
  title,
  subtitle,
  queryKey,
  fetchInvestors,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const investorsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchInvestors,
  });

  const allInvestors = investorsQuery.data ?? [];

  const investors = useMemo(
    () =>
      allInvestors.filter((investor) =>
        `${investor.displayName} ${investor.domain ?? ""} ${investor.headline ?? ""} ${
          investor.location ?? ""
        } ${investor.bio ?? ""} ${(investor.focusAreas ?? []).join(" ")}`
          .toLowerCase()
          .includes(deferredSearch),
      ),
    [allInvestors, deferredSearch],
  );

  const summary = useMemo(() => {
    const locationCount = new Set(
      allInvestors
        .map((investor) => investor.location?.trim())
        .filter((value): value is string => Boolean(value)),
    ).size;

    const focusAreaCount = new Set(
      allInvestors.flatMap((investor) =>
        (investor.focusAreas ?? []).map((focusArea) => focusArea.trim()),
      ),
    ).size;

    const proofReadyCount = allInvestors.filter(
      (investor) => investor.profileProofCount > 0,
    ).length;

    return {
      totalInvestors: allInvestors.length,
      visibleInvestors: investors.length,
      locationCount,
      focusAreaCount,
      proofReadyCount,
    };
  }, [allInvestors, investors.length]);

  const summaryItems = [
    {
      label: "Total investors",
      value: String(summary.totalInvestors),
      detail: "Profiles available in this directory",
      icon: Building2,
    },
    {
      label: "Visible now",
      value: String(summary.visibleInvestors),
      detail:
        deferredSearch.length > 0
          ? "Profiles matching the current search"
          : "Profiles shown without filters",
      icon: Search,
    },
    {
      label: "Locations",
      value: String(summary.locationCount),
      detail: "Cities and regions represented",
      icon: MapPin,
    },
    {
      label: "Focus areas",
      value: String(summary.focusAreaCount),
      detail: "Distinct sectors and themes covered",
      icon: BriefcaseBusiness,
    },
    {
      label: "Proof-ready",
      value: String(summary.proofReadyCount),
      detail: "Investors with public proof on profile",
      icon: ShieldCheck,
    },
  ];

  const hasResults = investors.length > 0;
  const isSearching = deferredSearch.length > 0;

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode={mode}
        eyebrow="Student Workspace"
        title={title}
        description={subtitle}
        tabsAction={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by investor, focus area, or location"
              className="rounded-full border-slate-700 bg-slate-950/70 pl-11 text-white placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
        }
      />

      <Card className="overflow-hidden border-slate-800 bg-slate-950/80">
        <div className="grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-5">
          {summaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="bg-slate-950 p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {item.label}
                </div>
                <div className="mt-3 text-3xl font-semibold text-white">
                  {item.value}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden border-slate-800 bg-slate-950/80">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Investor List
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Review investors with stronger profile context
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Use this view to scan focus, public proof, and contact
                preference before opening a full investor profile.
              </p>
            </div>
            <div className="text-sm text-slate-400">
              Showing{" "}
              <span className="font-semibold text-white">
                {summary.visibleInvestors}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-white">
                {summary.totalInvestors}
              </span>{" "}
              investors
            </div>
          </div>
        </div>

        {investorsQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-400">
            Loading investor directory...
          </div>
        ) : investorsQuery.isError ? (
          <div className="px-6 py-10 text-sm text-rose-200">
            Unable to load investors right now.
          </div>
        ) : hasResults ? (
          <div className="divide-y divide-slate-800">
            {investors.map((investor) => {
              const focusAreas = investor.focusAreas ?? [];
              const visibleFocusAreas = focusAreas.slice(0, 3);
              const hiddenFocusAreaCount = Math.max(
                focusAreas.length - visibleFocusAreas.length,
                0,
              );

              return (
                <article key={investor._id} className="px-6 py-6">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] text-lg font-semibold text-white">
                          {investor.avatar ? (
                            <img
                              src={investor.avatar}
                              alt={investor.displayName}
                              className="h-14 w-14 object-cover"
                            />
                          ) : (
                            investor.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-white">
                              {investor.displayName}
                            </h3>
                            {investor.domain ? (
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
                                {investor.domain}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-sm text-slate-300">
                            {investor.headline ?? "Public investor profile"}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
                            {investor.location ? (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-cyan-400" />
                                {investor.location}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-4 w-4 text-emerald-400" />
                              {investor.contactPreference}
                            </span>
                          </div>

                          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                            {investor.bio ??
                              "Review this profile for focus, public proof, and outreach fit before starting a conversation."}
                          </p>

                          {focusAreas.length > 0 ? (
                            <div className="mt-5 flex flex-wrap gap-2">
                              {visibleFocusAreas.map((focusArea) => (
                                <span
                                  key={`${investor._id}-${focusArea}`}
                                  className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300"
                                >
                                  {focusArea}
                                </span>
                              ))}
                              {hiddenFocusAreaCount > 0 ? (
                                <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-400">
                                  +{hiddenFocusAreaCount} more
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[272px] xl:shrink-0">
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 xl:border-t-0 xl:border-l xl:pl-6 xl:pt-0">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                            Experience
                          </div>
                          <div className="mt-2 inline-flex items-center gap-2 text-base font-semibold text-white">
                            <BriefcaseBusiness className="h-4 w-4 text-cyan-300" />
                            {investor.experienceCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                            Public proof
                          </div>
                          <div className="mt-2 inline-flex items-center gap-2 text-base font-semibold text-white">
                            <ShieldCheck className="h-4 w-4 text-emerald-300" />
                            {investor.profileProofCount}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        className="mt-5 w-full justify-between rounded-2xl border-slate-700 bg-slate-900 text-white hover:border-cyan-400/40 hover:bg-slate-900"
                        onClick={() =>
                          navigate(
                            getUserPortfolioViewPath("investor", investor._id),
                          )
                        }
                      >
                        <span>
                          {focusAreas.length > 0
                            ? "Open portfolio"
                            : "Open profile"}
                        </span>
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-10">
            <div className="text-lg font-semibold text-white">
              {isSearching ? "No investors match this search" : "No investors added yet"}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {isSearching
                ? "Try another keyword or clear the search to review investors by focus area, proof, and location."
                : "Investor profiles will appear here once they are available to your institution workspace."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
