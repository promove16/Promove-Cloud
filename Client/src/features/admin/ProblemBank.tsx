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
    <div className="space-y-8">
      <section className="border-b border-slate-800/80 pb-3">
        <div className="px-1 pb-6">
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr),auto] 2xl:items-end">
            <div className="min-w-0 max-w-4xl">
              <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Problem Bank Admin</div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{activeSection.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
            </div>

            <div className="text-sm text-slate-400">
              <span className="font-medium text-slate-100">{summary.totalProblems}</span> problems
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{summary.publishedProblems}</span> published
              <span className="mx-2 text-slate-700">/</span>
              <span className="font-medium text-slate-100">{summary.pendingReviews}</span> pending reviews
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
