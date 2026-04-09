import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { DirectoryInvestor } from '../../types/school.types';
import { getUserPortfolioViewPath } from '../marketplace/navigation';

type Props = {
  title: string;
  subtitle: string;
  queryKey: string;
  fetchInvestors: () => Promise<DirectoryInvestor[]>;
};

export function InvestorDirectoryBase({
  title,
  subtitle,
  queryKey,
  fetchInvestors,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const investorsQuery = useQuery({
    queryKey: [queryKey],
    queryFn: fetchInvestors,
  });

  const investors = useMemo(
    () =>
      (investorsQuery.data ?? []).filter((investor) =>
        `${investor.displayName} ${investor.domain ?? ''} ${investor.bio ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [investorsQuery.data, search],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-slate-400">{subtitle}</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by investor name or domain"
            className="pl-11"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {investors.map((investor) => (
          <Card key={investor._id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl font-bold text-white">
                  {investor.avatar ? (
                    <img
                      src={investor.avatar}
                      alt={investor.displayName}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    investor.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">{investor.displayName}</div>
                  <div className="mt-1 text-sm text-amber-300">
                    {investor.domain ?? 'Innovation investments'}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {investor.bio ?? 'Profile details are available inside the investor card.'}
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => navigate(getUserPortfolioViewPath('investor', investor._id))}>
                View Profile
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
