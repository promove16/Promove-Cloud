import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Eye, Search, Sparkles, BriefcaseBusiness } from 'lucide-react';
import { marketplaceApi, MarketplaceRole } from '../../api/marketplace.api';
import { recruiterApi } from '../../api/recruiter.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

const tabs: Array<{ id: MarketplaceRole; label: string }> = [
  { id: 'mentor', label: 'Mentors' },
  { id: 'investor', label: 'Investors' },
  { id: 'recruiter', label: 'Recruiters' },
];

function RecruiterJobCard({
  recruiterId,
  recruiterName,
  onApplyFeedback,
}: {
  recruiterId: string;
  recruiterName: string;
  onApplyFeedback: (tone: 'success' | 'error', message: string) => void;
}) {
  const jobsQuery = useQuery({
    queryKey: ['marketplace', 'recruiter-jobs', recruiterId],
    queryFn: () => recruiterApi.getPublicJobs(recruiterId),
    enabled: Boolean(recruiterId),
  });

  const applyToJob = async (jobId: string) => {
    try {
      await recruiterApi.applyToJob(jobId);
      await jobsQuery.refetch();
      onApplyFeedback('success', 'Applied! The recruiter can now contact you.');
    } catch {
      onApplyFeedback('error', 'Unable to apply to this job right now.');
    }
  };

  if (jobsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
      <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Open Job Posts</div>
      {(jobsQuery.data ?? []).length > 0 ? (
        (jobsQuery.data ?? []).map((job) => (
          <Card key={job._id} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold text-white">{job.title}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {job.company} - {job.location} - {job.type}
                </div>
                <p className="mt-2 text-sm text-slate-300">{job.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => applyToJob(job._id)}>
                  Apply
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="text-sm text-slate-400">{recruiterName} has no active openings right now.</div>
      )}
    </div>
  );
}

export function Marketplace() {
  const [role, setRole] = useState<MarketplaceRole>('recruiter');
  const [search, setSearch] = useState('');
  const [expandedRecruiterId, setExpandedRecruiterId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['marketplace', role],
    queryFn: () => marketplaceApi.list(role),
  });

  const profileList = useMemo(
    () =>
      (profilesQuery.data ?? []).filter((profile) =>
        `${profile.displayName} ${profile.domain ?? ''} ${profile.bio ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [profilesQuery.data, search],
  );

  const showBanner = (tone: 'success' | 'error', message: string) => {
    setBanner({ tone, message });
    window.setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
              <Sparkles className="h-4 w-4" />
              Student Marketplace
            </div>
            <h1 className="text-3xl font-bold text-white">Browse mentors, investors, and recruiters</h1>
            <p className="mt-2 text-slate-400">Recruiter cards now expand into live job posts with a one-click apply flow.</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people, companies, or domains"
              className="pl-11"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
          <Card className="h-fit p-4">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRole(tab.id);
                    setExpandedRecruiterId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    role === tab.id
                      ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'recruiter' ? <BriefcaseBusiness className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            {profilesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : (
              profileList.map((profile) => (
                <Card key={profile._id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-white">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt={profile.displayName} className="h-14 w-14 rounded-2xl object-cover" />
                        ) : (
                          profile.displayName.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{profile.displayName}</h3>
                        <div className="mt-1 text-sm text-cyan-300 capitalize">{profile.role}</div>
                        <div className="mt-2 text-sm text-slate-400">{profile.domain ?? 'General innovation support'}</div>
                        <p className="mt-3 max-w-2xl text-sm text-slate-300">
                          {profile.bio ?? 'Public profile details will appear here as more marketplace members complete their profiles.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setExpandedRecruiterId(expandedRecruiterId === profile._id ? null : profile._id)}
                      >
                        {expandedRecruiterId === profile._id ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                        {expandedRecruiterId === profile._id ? 'Hide Jobs' : 'View Jobs'}
                      </Button>
                      <Button onClick={() => setExpandedRecruiterId(profile._id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Profile
                      </Button>
                    </div>
                  </div>

                  {role === 'recruiter' && expandedRecruiterId === profile._id ? (
                    <RecruiterJobCard
                      recruiterId={profile._id}
                      recruiterName={profile.displayName}
                      onApplyFeedback={showBanner}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      {banner ? (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl ${
            banner.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          }`}
        >
          {banner.message}
        </div>
      ) : null}
    </div>
  );
}
