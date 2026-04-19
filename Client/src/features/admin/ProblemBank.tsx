import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { AdminSectionTabs, getActiveAdminSection } from './AdminSectionTabs';
import { ADMIN_PROBLEMS_SECTION_LINKS } from './problemsNavigation';

export default function ProblemBankAdmin() {
  const location = useLocation();
  const activeSection = getActiveAdminSection(location.pathname, ADMIN_PROBLEMS_SECTION_LINKS);

  const problemsQuery = useQuery({
    queryKey: ['admin-problems'],
    queryFn: adminApi.getProblems,
  });

  const reviewQueueQuery = useQuery({
    queryKey: ['admin-problem-review-requests'],
    queryFn: () => adminApi.getProblemReviewRequests({ status: 'review_requested' }),
  });

  const summary = useMemo(
    () => ({
      totalProblems: problemsQuery.data?.length ?? 0,
      pendingReviews: reviewQueueQuery.data?.length ?? 0,
      publishedProblems:
        problemsQuery.data?.filter((problem) => problem.publicationStatus === 'published').length ?? 0,
    }),
    [problemsQuery.data, reviewQueueQuery.data],
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Problem Bank Admin</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[32rem]">
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Total problems</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.totalProblems}</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Published</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.publishedProblems}</div>
              </div>
              <div className="border border-slate-800 bg-slate-950 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Pending reviews</div>
                <div className="mt-2 text-sm font-medium text-white">{summary.pendingReviews}</div>
              </div>
            </div>
          </div>
        </div>

        <AdminSectionTabs links={ADMIN_PROBLEMS_SECTION_LINKS} />
      </section>

      {problemsQuery.isLoading && reviewQueueQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : problemsQuery.isError || reviewQueueQuery.isError ? (
        <Card className="border-dashed p-6 text-sm text-slate-400">
          Problem bank data is unavailable right now.
        </Card>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
