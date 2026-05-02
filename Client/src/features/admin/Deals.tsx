import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { adminApi, type AdminDealItem } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
import { ADMIN_DEALS_SECTION_LINKS } from './dealsNavigation';

export interface AdminDealsOutletContext {
  deals: AdminDealItem[];
  urgentDeals: AdminDealItem[];
  totalRoyaltyPool: number;
  approvedDeals: number;
  approveBusy: boolean;
  approveDeal: (dealId: string) => void;
}

export function useAdminDealsContext() {
  return useOutletContext<AdminDealsOutletContext>();
}

export default function Deals() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_DEALS_SECTION_LINKS);

  const dealsQuery = useQuery({
    queryKey: ['admin-deals'],
    queryFn: adminApi.getDeals,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: adminApi.approveDealStage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    },
  });

  const deals = dealsQuery.data ?? [];
  const urgentDeals = useMemo(
    () =>
      deals.filter(
        (deal) =>
          deal.stage === 3 &&
          deal.adminApprovalRequired &&
          deal.stockTransfer.status !== 'approved' &&
          deal.stockTransfer.status !== 'rejected' &&
          !deal.adminApprovedAt,
      ),
    [deals],
  );
  const totalRoyaltyPool = useMemo(
    () => deals.reduce((sum, deal) => sum + deal.royalty.promoveAmountINR, 0),
    [deals],
  );
  const approvedDeals = useMemo(
    () => deals.filter((deal) => deal.mediationStatus === 'approved' || Boolean(deal.adminApprovedAt)).length,
    [deals],
  );

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="px-1 pb-6">
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr),auto] 2xl:items-end">
            <div className="min-w-0 max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Deals</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="text-sm text-slate-400">
              <span className="font-medium text-slate-100">{deals.length}</span> deals
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{urgentDeals.length}</span> pending transfer
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{approvedDeals}</span> approved
            </div>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_DEALS_SECTION_LINKS} />
      </section>

      {dealsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : dealsQuery.isError ? (
        <Card className="border-dashed p-6 text-sm text-slate-400">
          Deal data is unavailable right now.
        </Card>
      ) : (
        <Outlet
          context={{
            deals,
            urgentDeals,
            totalRoyaltyPool,
            approvedDeals,
            approveBusy: approveMutation.isPending,
            approveDeal: (dealId: string) => approveMutation.mutate(dealId),
          }}
        />
      )}
    </div>
  );
}
