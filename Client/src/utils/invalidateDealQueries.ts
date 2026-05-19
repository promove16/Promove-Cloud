import type { QueryClient } from '@tanstack/react-query';

interface InvalidateDealQueriesOptions {
  dealId?: string;
  startupId?: string;
}

/**
 * Invalidate every React Query cache key that surfaces deal state.
 *
 * Why: A single negotiation/agreement mutation can affect data shown across
 * Overview, Cap Table, Setup, Equity & Deals, Outreach, Investor Dashboard,
 * Portfolio, Marketplace, and Admin Deals. Each of those pages reads from a
 * different query key, so any deal-changing mutation must broadcast a refetch
 * to all of them.
 */
export function invalidateDealQueries(
  queryClient: QueryClient,
  { dealId, startupId }: InvalidateDealQueriesOptions = {},
): Promise<unknown> {
  const tasks: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ['deal'] }),
    queryClient.invalidateQueries({ queryKey: ['deals'] }),
    queryClient.invalidateQueries({ queryKey: ['student-deals'] }),
    queryClient.invalidateQueries({ queryKey: ['student', 'active-deals'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-deal'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-deals'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-portfolio'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-bids'] }),
    queryClient.invalidateQueries({ queryKey: ['investor-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['startup-bids'] }),
    queryClient.invalidateQueries({ queryKey: ['startup-bid-board'] }),
    queryClient.invalidateQueries({ queryKey: ['startup-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['founder-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-deals'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['activity-feed'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  ];

  if (dealId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['deal', dealId] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['investor-deal', dealId] }));
  }

  if (startupId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup', startupId] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup', startupId, 'cap-table'] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup', startupId, 'timeline'] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup', 'cap-table', startupId] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup-bid-board', startupId] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['startup-bids', startupId] }));
  }

  return Promise.all(tasks);
}
