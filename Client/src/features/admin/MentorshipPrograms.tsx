import MentorshipProgramsPanel from './MentorshipProgramsPanel';

export default function MentorshipPrograms() {
  return (
    <div className="space-y-6">
      <div className="max-w-4xl">
        <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Admin Mentorship</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Mentor operations</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Create mentor access, match mentors to school or college programs, and assign mentors to active project workspaces from one admin surface.
        </p>
      </div>

      <MentorshipProgramsPanel />
    </div>
  );
}
