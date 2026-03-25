import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { DirectoryInvestor } from '../../types/school.types';

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
  const [search, setSearch] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<DirectoryInvestor | null>(null);

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
              <Button variant="secondary" onClick={() => setSelectedInvestor(investor)}>
                View Profile
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedInvestor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedInvestor.displayName}</h2>
                <p className="mt-2 text-sm text-amber-300">
                  {selectedInvestor.domain ?? 'Innovation investments'}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedInvestor(null)}>
                Close
              </Button>
            </div>
            <p className="mt-4 leading-7 text-slate-300">
              {selectedInvestor.bio ?? 'This investor has not added a public bio yet.'}
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
              <Mail className="h-4 w-4" />
              {selectedInvestor.contactPreference}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
