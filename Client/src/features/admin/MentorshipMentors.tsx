import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import {
  Search,
  UserPlus,
  Mail,
  Copy,
  X,
  GraduationCap,
  Briefcase,
  Calendar,
  Sparkles,
  Award,
  Check,
  Star,
  User
} from 'lucide-react';
import { AdminMentorListItem } from '../../types/mentorship.types';

// ─── Theme Configurations for Expertises ────────────────────────────────────

const DOMAIN_THEME: Record<string, { bg: string; text: string; gradient: string; border: string }> = {
  aiml: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/10',
    text: 'text-cyan-400 dark:text-cyan-300',
    gradient: 'from-cyan-500 to-blue-600',
    border: 'border-cyan-500/20'
  },
  webdev: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/10',
    text: 'text-emerald-400 dark:text-emerald-300',
    gradient: 'from-emerald-400 to-teal-600',
    border: 'border-emerald-500/20'
  },
  cybersecurity: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/10',
    text: 'text-rose-400 dark:text-rose-300',
    gradient: 'from-rose-500 to-red-600',
    border: 'border-rose-500/20'
  },
  cloud: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/10',
    text: 'text-amber-400 dark:text-amber-300',
    gradient: 'from-amber-400 to-orange-600',
    border: 'border-amber-500/20'
  },
  blockchain: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/10',
    text: 'text-violet-400 dark:text-violet-300',
    gradient: 'from-violet-500 to-purple-600',
    border: 'border-violet-500/20'
  },
  default: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/10',
    text: 'text-blue-400 dark:text-blue-300',
    gradient: 'from-blue-500 to-indigo-600',
    border: 'border-blue-500/20'
  }
};

const getDomainTheme = (domain?: string) => {
  if (!domain) return DOMAIN_THEME.default;
  const d = domain.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (d.includes('aiml') || d.includes('ai') || d.includes('machinelearning')) return DOMAIN_THEME.aiml;
  if (d.includes('web') || d.includes('frontend') || d.includes('backend') || d.includes('fullstack') || d.includes('dev')) return DOMAIN_THEME.webdev;
  if (d.includes('cyber') || d.includes('security') || d.includes('infosec')) return DOMAIN_THEME.cybersecurity;
  if (d.includes('cloud') || d.includes('aws') || d.includes('devops')) return DOMAIN_THEME.cloud;
  if (d.includes('block') || d.includes('crypto') || d.includes('web3')) return DOMAIN_THEME.blockchain;
  return DOMAIN_THEME.default;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export default function MentorshipMentors() {
  const queryClient = useQueryClient();
  
  // Roster parameters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Modal / inspector views state
  const [selectedMentor, setSelectedMentor] = useState<AdminMentorListItem | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    displayName: '',
    email: '',
    domain: '',
    headline: '',
    bio: '',
  });
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  // Queries
  const mentorsQuery = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: adminApi.getMentors,
  });

  // Onboarding mutation
  const onboardMutation = useMutation({
    mutationFn: adminApi.createMentorProfile,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-mentors'] });
      setCreatedCredentials({
        name: data.mentor.displayName,
        email: data.mentor.email,
        password: data.temporaryPassword,
      });
      setShowOnboardModal(false);
      setOnboardForm({ displayName: '', email: '', domain: '', bio: '', headline: '' });
      toast.success('Mentor profile registered successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to onboard mentor');
    },
  });

  const mentors = mentorsQuery.data ?? [];

  // Parse stats
  const statsSummary = useMemo(() => {
    const total = mentors.length;
    const activeProjects = mentors.reduce((acc, m) => acc + m.assignedProjects, 0);
    const activePrograms = mentors.reduce((acc, m) => acc + m.assignedPrograms, 0);
    const scored = mentors.filter((m) => m.mentorScore && m.mentorScore.total > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((acc, m) => acc + (m.mentorScore?.total ?? 0), 0) / scored.length)
      : 0;
    
    return { total, activeProjects, activePrograms, avgScore };
  }, [mentors]);

  // Dynamic filter categories (domains)
  const domains = useMemo(() => {
    const list = ['All'];
    mentors.forEach((m) => {
      if (m.domain) {
        const d = m.domain.trim();
        if (d && !list.includes(d)) {
          list.push(d);
        }
      }
    });
    return list;
  }, [mentors]);

  // Filtering & Sorting logic
  const filteredAndSortedMentors = useMemo(() => {
    let result = [...mentors];

    // Search query match
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.domain?.toLowerCase().includes(q) ||
          m.headline?.toLowerCase().includes(q) ||
          m.bio?.toLowerCase().includes(q)
      );
    }

    // Domain category filter
    if (selectedDomain !== 'All') {
      result = result.filter((m) => m.domain?.trim() === selectedDomain.trim());
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'score') {
        const scoreA = a.mentorScore?.total ?? 0;
        const scoreB = b.mentorScore?.total ?? 0;
        return scoreB - scoreA;
      }
      if (sortBy === 'rank') {
        const rankA = a.mentorScore?.rank ?? 999999;
        const rankB = b.mentorScore?.rank ?? 999999;
        return rankA - rankB;
      }
      if (sortBy === 'projects') {
        return b.assignedProjects - a.assignedProjects;
      }
      if (sortBy === 'programs') {
        return b.assignedPrograms - a.assignedPrograms;
      }
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return result;
  }, [mentors, searchTerm, selectedDomain, sortBy]);

  const copyEmailToClipboard = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(email);
    toast.success('Email address copied');
  };

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.displayName.trim()) {
      toast.error('DisplayName is required');
      return;
    }
    if (!onboardForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    onboardMutation.mutate(onboardForm);
  };

  return (
    <div className="space-y-6">
      {/* Overview stats header banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
          <div className="absolute right-3 top-3 rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
            <User className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Roster</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{statsSummary.total}</span>
            <span className="text-xs text-slate-400">mentors</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
          <div className="absolute right-3 top-3 rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active Load</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{statsSummary.activeProjects + statsSummary.activePrograms}</span>
            <span className="text-xs text-slate-400">active tasks</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
          <div className="absolute right-3 top-3 rounded-lg bg-violet-500/10 p-2 text-violet-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Average Rating</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{statsSummary.avgScore}</span>
            <span className="text-xs text-slate-400">pts avg</span>
          </div>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-400">Mentor Capacity</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Available mentor roster</h2>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-2 rounded-xl"
              onClick={() => setShowOnboardModal(true)}
            >
              <UserPlus className="h-4 w-4" />
              Onboard Mentor
            </Button>
          </div>
        </div>

        {/* Search, filters, sorting controls */}
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-800/80 pt-6 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by name, email, expertise area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-slate-800 bg-slate-900/50 pl-10 text-white placeholder-slate-500 focus:border-cyan-500"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="name">Name (A-Z)</option>
              <option value="score">Top Score</option>
              <option value="rank">Leaderboard Rank</option>
              <option value="projects">Assigned Projects</option>
              <option value="programs">Assigned Programs</option>
              <option value="createdAt">Date Joined</option>
            </select>
          </div>
        </div>

        {/* Dynamic Domain pill buttons */}
        {domains.length > 2 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                  selectedDomain === dom
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>
        ) : null}

        {/* Mentors roster grid container */}
        <div className="mt-8">
          {mentorsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : filteredAndSortedMentors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 py-16 text-center">
              <div className="rounded-full bg-slate-900 p-4 text-slate-600">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">No mentors found</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-sm">
                Try adjusting your search criteria, selecting another domain, or onboard a new mentor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedMentors.map((mentor) => {
                const theme = getDomainTheme(mentor.domain);
                const initials = getInitials(mentor.displayName);
                
                return (
                  <div
                    key={mentor._id}
                    onClick={() => setSelectedMentor(mentor)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900 hover:shadow-[0_0_20px_-5px_rgba(34,211,238,0.1),0_8px_30px_rgb(0,0,0)]"
                  >
                    {/* Hover status background highlights */}
                    <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${theme.gradient} opacity-40 group-hover:opacity-100 transition duration-300`} />
                    
                    <div className="flex items-start justify-between gap-4">
                      {/* Avatar initials with domain theme colors */}
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${theme.gradient} text-sm font-bold text-white shadow-inner`}>
                        {initials}
                      </div>

                      {/* Top right Rank Score tag */}
                      <div className="text-right">
                        {mentor.mentorScore ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                              <Star className="h-3 w-3 fill-cyan-300 text-cyan-300" />
                              {mentor.mentorScore.total} pts
                            </span>
                            {mentor.mentorScore.rank > 0 ? (
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Rank #{mentor.mentorScore.rank}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">Pending activity</span>
                        )}
                      </div>
                    </div>

                    {/* Mentor profile details */}
                    <div className="mt-4 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-cyan-300 transition duration-150 truncate">
                        {mentor.displayName}
                      </h3>
                      
                      <div className="mt-1 flex items-center gap-2">
                        <span className="truncate text-xs text-slate-400">{mentor.email}</span>
                        <button
                          onClick={(e) => copyEmailToClipboard(mentor.email, e)}
                          className="text-slate-600 hover:text-slate-300 p-0.5 transition shrink-0"
                          title="Copy Email"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Expertise tags */}
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {mentor.domain ? (
                          <Badge className={`${theme.bg} ${theme.text} ${theme.border} border text-[10px] tracking-wider px-2 py-0.5`}>
                            {mentor.domain}
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px] tracking-wider px-2 py-0.5">
                            General
                          </Badge>
                        )}
                      </div>

                    </div>

                    {/* Footer stats row inside card */}
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-4 text-center">
                      <div className="min-w-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Projects</div>
                        <div className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-white">
                          <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                          {mentor.assignedProjects}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Programs</div>
                        <div className="mt-1 flex items-center justify-center gap-1 text-sm font-semibold text-white">
                          <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                          {mentor.assignedPrograms}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Joined</div>
                        <div className="mt-1 flex items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-400">
                          {new Date(mentor.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ─── Mentor Details Inspector Modal ─────────────────────────────────── */}
      {selectedMentor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            {/* Header domain ribbon */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${getDomainTheme(selectedMentor.domain).gradient}`} />
            
            <button
              onClick={() => setSelectedMentor(null)}
              className="absolute right-4 top-4 rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-slate-400 transition hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 sm:p-8">
              {/* Profile Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getDomainTheme(selectedMentor.domain).gradient} text-xl font-bold text-white shadow-lg`}>
                  {getInitials(selectedMentor.displayName)}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold text-white">{selectedMentor.displayName}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{selectedMentor.email}</p>
                  
                  {selectedMentor.headline ? (
                    <p className="mt-2 text-xs italic text-slate-500 leading-normal">
                      "{selectedMentor.headline}"
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMentor.domain ? (
                      <Badge className={`${getDomainTheme(selectedMentor.domain).bg} ${getDomainTheme(selectedMentor.domain).text} border ${getDomainTheme(selectedMentor.domain).border} text-[10px] tracking-wider px-2.5 py-0.5`}>
                        {selectedMentor.domain}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px] tracking-wider px-2.5 py-0.5">
                        General Mentorship
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio block description */}
              {selectedMentor.bio ? (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedMentor.bio}
                  </p>
                </div>
              ) : null}

              {/* Score breakdowns panel */}
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Mentorship Scoreboard</span>
                  </div>
                  {selectedMentor.mentorScore ? (
                    <div className="text-right">
                      <span className="text-lg font-bold text-white">{selectedMentor.mentorScore.total} <span className="text-xs text-slate-400">pts</span></span>
                      {selectedMentor.mentorScore.rank > 0 ? (
                        <div className="text-[10px] text-cyan-400 uppercase font-semibold">Rank #{selectedMentor.mentorScore.rank}</div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-semibold">No performance index yet</span>
                  )}
                </div>

                {/* Score breakdown metrics list */}
                <div className="mt-4 space-y-3.5">
                  {[
                    { label: 'Phase 1: Induction & Preparation', val: selectedMentor.mentorScore?.phase1 ?? 0 },
                    { label: 'Phase 2: Project Collaboration', val: selectedMentor.mentorScore?.phase2 ?? 0 },
                    { label: 'Phase 3: Program Execution', val: selectedMentor.mentorScore?.phase3 ?? 0 }
                  ].map((p, idx) => {
                    const maxVal = 100;
                    const pct = Math.min(100, Math.round((p.val / maxVal) * 100));
                    return (
                      <div key={idx} className="text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs text-slate-400">{p.label}</span>
                          <span className="font-mono text-xs font-semibold text-white">{p.val} / {maxVal}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roster stats metadata details */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-4 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned Tasks</div>
                  <div className="mt-2 flex items-center justify-center gap-4 text-slate-300">
                    <div>
                      <div className="text-base font-bold text-white">{selectedMentor.assignedProjects}</div>
                      <div className="text-[9px] text-slate-500 uppercase">Projects</div>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <div className="text-base font-bold text-white">{selectedMentor.assignedPrograms}</div>
                      <div className="text-[9px] text-slate-500 uppercase">Programs</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-4 flex flex-col justify-center items-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Onboard Date</div>
                  <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    {new Date(selectedMentor.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>

              {/* Inspector action row */}
              <div className="mt-8 flex justify-between gap-3 border-t border-slate-800 pt-6">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 w-full text-xs font-semibold py-2.5 rounded-xl"
                  onClick={(e) => copyEmailToClipboard(selectedMentor.email, e)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Details
                </Button>
                <a
                  href={`mailto:${selectedMentor.email}`}
                  className="w-full"
                >
                  <Button
                    variant="primary"
                    className="flex items-center gap-2 w-full text-xs font-semibold py-2.5 rounded-xl"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Send Email
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Onboard Mentor Input Form Modal ───────────────────────────────── */}
      {showOnboardModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-purple-600" />
            
            <button
              onClick={() => setShowOnboardModal(false)}
              className="absolute right-4 top-4 rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-slate-400 transition hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            <form onSubmit={handleOnboardSubmit} className="p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-cyan-400" />
                Onboard New Mentor
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Register a new mentor profile. A temporary login password will be generated for them.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Full Name *</label>
                  <Input
                    type="text"
                    required
                    placeholder="Enter display name"
                    value={onboardForm.displayName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, displayName: e.target.value })}
                    className="border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-cyan-500 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address *</label>
                  <Input
                    type="email"
                    required
                    placeholder="Enter email address"
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    className="border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-cyan-500 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Domain / Specialty Area</label>
                  <Input
                    type="text"
                    placeholder="e.g. AI/ML, Cybersecurity, Web Development"
                    value={onboardForm.domain}
                    onChange={(e) => setOnboardForm({ ...onboardForm, domain: e.target.value })}
                    className="border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-cyan-500 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Headline</label>
                  <Input
                    type="text"
                    placeholder="e.g. Principal AI Scientist at Google"
                    value={onboardForm.headline}
                    onChange={(e) => setOnboardForm({ ...onboardForm, headline: e.target.value })}
                    className="border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-cyan-500 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Short Bio / Background</label>
                  <textarea
                    placeholder="Provide a brief summary of background, expertise and experience..."
                    value={onboardForm.bio}
                    onChange={(e) => setOnboardForm({ ...onboardForm, bio: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-slate-800 pt-6">
                <Button
                  variant="ghost"
                  onClick={() => setShowOnboardModal(false)}
                  className="rounded-xl font-semibold px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={onboardMutation.isPending}
                  className="rounded-xl font-semibold px-5 py-2.5 flex items-center gap-2"
                >
                  {onboardMutation.isPending ? (
                    <>
                      <Spinner />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Register Mentor
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ─── Temporary Credential Reveal Dialog ───────────────────────────── */}
      {createdCredentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <Check className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-xl font-bold text-white">Mentor Account Created</h3>
            <p className="mt-2 text-xs text-slate-400">
              Below are the temporary login credentials. Please share them securely.
            </p>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5 text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</div>
              <div className="text-sm font-semibold text-white mt-0.5">{createdCredentials.name}</div>
              
              <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Login Username (Email)</div>
              <div className="text-sm font-semibold text-white mt-0.5">{createdCredentials.email}</div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Temporary Password</div>
                <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2">
                  <span className="font-mono text-sm font-bold text-emerald-300 break-all select-all">
                    {createdCredentials.password}
                  </span>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(createdCredentials.password);
                      toast.success('Temporary password copied');
                    }}
                    className="rounded p-1 text-slate-400 hover:text-white transition shrink-0"
                    title="Copy Password"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button
                variant="primary"
                className="w-full rounded-xl py-3 font-semibold"
                onClick={() => setCreatedCredentials(null)}
              >
                Close & Finish
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

