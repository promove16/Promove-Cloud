import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Github, GraduationCap, Linkedin, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { userApi } from '../../api/user.api';

export function PublicStudentProfilePage() {
  const { profileSlug = '' } = useParams();
  const profileQuery = useQuery({
    queryKey: ['public-student-profile', profileSlug],
    queryFn: () => userApi.getPublicStudentProfile(profileSlug),
    enabled: profileSlug.trim().length > 0,
  });

  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-sm text-slate-400">Loading public profile...</div>
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Card className="p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Public Profile</div>
            <h1 className="mt-4 text-3xl font-bold text-white">Profile not available</h1>
            <p className="mt-3 text-slate-400">
              This student profile is not public yet or the share link is invalid.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Go to ProMove
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const recentProjects = profile.portfolioProjects.slice(0, 6);
  const recentActivity = profile.githubProof.recentActivity.slice(0, 6);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_#020617,_#0f172a)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-6 rounded-[32px] border border-slate-800 bg-slate-950/85 p-8 shadow-2xl lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-500 text-3xl font-bold text-white">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.displayName} className="h-24 w-24 rounded-[28px] object-cover" />
              ) : (
                profile.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold text-white">{profile.displayName}</h1>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Student
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-slate-300">
                {profile.bio ?? profile.headline ?? 'This student has not added a public overview yet.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                {profile.domain ? (
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    {profile.domain}
                  </span>
                ) : null}
                {profile.location ? (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    {profile.location}
                  </span>
                ) : null}
                {profile.institution ? (
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-cyan-300" />
                    {profile.institution.displayName}
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {profile.githubUrl ? (
                  <a
                    href={profile.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-200"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {profile.linkedinUrl ? (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-200"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {profile.websiteUrl ? (
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-200"
                  >
                    Website
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Innovation Score</div>
              <div className="mt-3 text-3xl font-bold text-white">{profile.innovationScore}</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Repositories</div>
              <div className="mt-3 text-3xl font-bold text-white">{profile.githubProof.importedRepos.length}</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Skills</div>
              <div className="mt-3 text-3xl font-bold text-white">{profile.skills.length}</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">30-Day Commits</div>
              <div className="mt-3 text-3xl font-bold text-white">{profile.githubProof.commitCount30Days}</div>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Projects</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Proof of work</h2>
              </div>
              <div className="text-sm text-slate-500">{recentProjects.length} shown</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recentProjects.map((project) => (
                <div key={project._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{project.title}</div>
                      <div className="mt-2 text-sm text-slate-400">
                        {project.description || 'No public description available.'}
                      </div>
                    </div>
                    {project.stars > 0 ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {project.stars}
                      </div>
                    ) : null}
                  </div>
                  {project.techStack.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {project.techStack.slice(0, 5).map((item) => (
                        <span key={item} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    {project.repoUrl ? (
                      <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                        Repository
                      </a>
                    ) : null}
                    {project.liveUrl ? (
                      <a href={project.liveUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">
                        Live demo
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
              {recentProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
                  No public projects have been added yet.
                </div>
              ) : null}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Skills</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Current strengths</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.skills.slice(0, 18).map((skill) => (
                  <span key={`${skill.name}-${skill.source}`} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-slate-200">
                    {skill.name}
                  </span>
                ))}
                {profile.skills.length === 0 ? (
                  <div className="text-sm text-slate-400">No public skills added yet.</div>
                ) : null}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">GitHub Signal</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Recent activity</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-900 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Repos</div>
                  <div className="mt-2 text-2xl font-bold text-white">{profile.githubStats.totalRepos}</div>
                </div>
                <div className="rounded-2xl bg-slate-900 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Stars</div>
                  <div className="mt-2 text-2xl font-bold text-white">{profile.githubStats.totalStars}</div>
                </div>
                <div className="rounded-2xl bg-slate-900 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pull Requests</div>
                  <div className="mt-2 text-2xl font-bold text-white">{profile.githubProof.pullRequests30Days}</div>
                </div>
                <div className="rounded-2xl bg-slate-900 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Days</div>
                  <div className="mt-2 text-2xl font-bold text-white">{profile.githubProof.activeDays30Days}</div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="font-semibold text-white">{activity.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{activity.summary}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {activity.repoFullName} · {new Date(activity.occurredAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 ? (
                  <div className="text-sm text-slate-400">No recent public GitHub activity available.</div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
