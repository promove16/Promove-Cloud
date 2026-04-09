import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, MessageCircle, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { marketplaceApi } from '../../api/marketplace.api';
import { getUserPortfolioViewPath } from '../marketplace/navigation';

type Props = {
  title?: string;
  subtitle?: string;
};

export function MentorDirectory({
  title = 'Mentor Directory',
  subtitle = 'Connect with mentors who guide innovation programs',
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleMessage = (mentorId: string) => {
    const storageKey = `dm_first_contact_${mentorId}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, 'true');
    }
    navigate(`/dashboard/messages/${mentorId}`);
  };

  const mentorsQuery = useQuery({
    queryKey: ['marketplace-mentors'],
    queryFn: () => marketplaceApi.list('mentor'),
  });

  const mentors = useMemo(
    () =>
      (mentorsQuery.data ?? []).filter((mentor) =>
        `${mentor.displayName} ${mentor.domain ?? ''} ${mentor.bio ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [mentorsQuery.data, search],
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
            placeholder="Search by mentor name or domain"
            className="pl-11"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {mentors.map((mentor) => (
          <Card key={mentor._id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-xl font-bold text-white">
                  {mentor.avatar ? (
                    <img
                      src={mentor.avatar}
                      alt={mentor.displayName}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    mentor.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">{mentor.displayName}</div>
                  <div className="mt-1 text-sm text-cyan-300">{mentor.domain ?? 'Innovation mentoring'}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {mentor.bio ?? 'Profile details are available inside the mentor view.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleMessage(mentor._id)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message
                </Button>
                <Button variant="secondary" onClick={() => navigate(getUserPortfolioViewPath('mentor', mentor._id))}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Profile
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
}
