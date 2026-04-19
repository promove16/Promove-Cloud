import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  FolderKanban,
  Rocket,
  Send,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { startupApi } from '../../api/startup.api';
import { workspaceApi } from '../../api/workspace.api';
import { Startup } from '../../types/startup.types';
import { Workspace } from '../../types/workspace.types';

interface InvestorProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  recipientName: string;
  isStudent: boolean;
  preferredStartupId?: string;
}

type ProposalSource = {
  name: string;
  tagline: string;
  category: string;
  stage: Startup['stage'];
  fundingNeeded?: number;
  teamSize: number;
  pitchDeckUrl?: string;
  traction: Startup['traction'];
  kindLabel: 'startup' | 'project';
};

const stageColors: Record<string, string> = {
  'Pre-Idea': 'text-slate-400 bg-slate-700',
  Ideation: 'text-yellow-400 bg-yellow-400/10',
  MVP: 'text-blue-400 bg-blue-400/10',
  'Pre-Launch': 'text-orange-400 bg-orange-400/10',
  Launched: 'text-emerald-400 bg-emerald-400/10',
};

const defaultTraction: Startup['traction'] = {
  patentFiled: false,
  mvpBuilt: false,
  revenueGenerating: false,
};

const workspaceStageToPitchStage: Record<Workspace['stage'], Startup['stage']> = {
  Ideation: 'Ideation',
  Problem: 'Pre-Idea',
  Build: 'MVP',
  Patent: 'Pre-Launch',
  Launch: 'Launched',
};

const formatInrAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const getProjectTeamSize = (project: Workspace) =>
  project.teamMembers?.length ?? project.teamMemberIds.length ?? 1;

const buildProposalSource = (
  startups: Startup[] | undefined,
  selectedProject: Workspace | null,
  selectedStartupId: string | null,
): ProposalSource | null => {
  const startupList = startups ?? [];
  const linkedStartupFromProject = selectedProject
    ? startupList.find((startup) => startup.projectId === selectedProject._id) ?? null
    : null;
  const selectedStartup = !selectedProject
    ? startupList.find((startup) => startup._id === selectedStartupId) ??
      (startupList.length === 1 ? startupList[0] : null)
    : null;

  if (selectedProject) {
    return {
      name: linkedStartupFromProject?.name || selectedProject.title,
      tagline:
        linkedStartupFromProject?.tagline ||
        `${selectedProject.title} is a ${selectedProject.category} project currently in the ${selectedProject.stage} stage.`,
      category: linkedStartupFromProject?.category || selectedProject.category,
      stage: linkedStartupFromProject?.stage || workspaceStageToPitchStage[selectedProject.stage],
      fundingNeeded: linkedStartupFromProject?.fundingNeeded,
      teamSize: linkedStartupFromProject?.teamSize || getProjectTeamSize(selectedProject),
      pitchDeckUrl: linkedStartupFromProject?.pitchDeckUrl,
      traction: linkedStartupFromProject?.traction || defaultTraction,
      kindLabel: linkedStartupFromProject ? 'startup' : 'project',
    };
  }

  if (!selectedStartup) {
    return null;
  }

  return {
    name: selectedStartup.name,
    tagline: selectedStartup.tagline,
    category: selectedStartup.category,
    stage: selectedStartup.stage,
    fundingNeeded: selectedStartup.fundingNeeded,
    teamSize: selectedStartup.teamSize,
    pitchDeckUrl: selectedStartup.pitchDeckUrl,
    traction: selectedStartup.traction,
    kindLabel: 'startup',
  };
};

function buildFullProposal(source: ProposalSource, note: string): string {
  const funding = source.fundingNeeded
    ? formatInrAmount(source.fundingNeeded)
    : 'Not disclosed';

  const tractionParts: string[] = [];
  if (source.traction.patentFiled) tractionParts.push('Patent filed');
  if (source.traction.mvpBuilt) tractionParts.push('MVP built');
  if (source.traction.revenueGenerating) tractionParts.push('Revenue generating');
  if (source.traction.usersCount) tractionParts.push(`${source.traction.usersCount.toLocaleString()} users`);

  const lines = [
    `Hi! I'd like to formally pitch my ${source.kindLabel} for investment consideration.`,
    '',
    `Startup: ${source.name}`,
    source.tagline,
    `Category: ${source.category || 'N/A'}`,
    `Stage: ${source.stage}`,
    `Funding Needed: ${funding}`,
    `Team Size: ${source.teamSize}`,
    ...(tractionParts.length ? [`Traction: ${tractionParts.join(' | ')}`] : []),
    ...(source.pitchDeckUrl ? [`Pitch Deck: ${source.pitchDeckUrl}`] : []),
    '',
    note.trim() || `I would love to walk you through our vision and discuss how your investment could help us scale. Are you open to a call?`,
  ];

  return lines.join('\n');
}

export function InvestorProposalModal({
  isOpen,
  onClose,
  onSend,
  recipientName,
  isStudent,
  preferredStartupId,
}: InvestorProposalModalProps) {
  const [customNote, setCustomNote] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(preferredStartupId ?? null);

  const startupQuery = useQuery({
    queryKey: ['startup', 'mine'],
    queryFn: startupApi.mine,
    enabled: isOpen && isStudent,
    staleTime: 60_000,
  });

  const workspaceQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
    enabled: isOpen && isStudent,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isOpen) {
      setCustomNote('');
      setSelectedProjectId(null);
      setSelectedStartupId(preferredStartupId ?? null);
    }
  }, [isOpen, preferredStartupId]);

  const startups = startupQuery.data;
  const projects = workspaceQuery.data ?? [];
  const startupOptions = startups ?? [];
  const isSourceLocked = Boolean(preferredStartupId);

  useEffect(() => {
    if (!isOpen || isSourceLocked || startupQuery.isLoading || workspaceQuery.isLoading) {
      return;
    }

    if (selectedStartupId || selectedProjectId) {
      return;
    }

    if (startupOptions.length === 1 && projects.length === 0) {
      setSelectedStartupId(startupOptions[0]._id);
      return;
    }

    if (startupOptions.length === 0 && projects.length === 1) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [
    isOpen,
    isSourceLocked,
    projects,
    selectedProjectId,
    selectedStartupId,
    startupOptions,
    startupQuery.isLoading,
    workspaceQuery.isLoading,
  ]);

  const selectedProject = projects.find((project) => project._id === selectedProjectId) ?? null;
  const proposalSource = buildProposalSource(
    startups,
    selectedProject,
    preferredStartupId ?? selectedStartupId,
  );

  const isLoading = isStudent && (startupQuery.isLoading || workspaceQuery.isLoading);
  const hasProjects = projects.length > 0;
  const hasStartups = startupOptions.length > 0;
  const hasSelectableSources = hasStartups || hasProjects;
  const canChooseSource = !isSourceLocked && startupOptions.length + projects.length > 1;
  const showSourcePicker = isStudent && !proposalSource && !isSourceLocked && hasSelectableSources;

  if (!isOpen) return null;

  const quickMessages = proposalSource
    ? [
        `Hi! I'd like to pitch my ${proposalSource.kindLabel} **${proposalSource.name}** for investment. We're at ${proposalSource.stage} stage${proposalSource.fundingNeeded ? `, seeking ${formatInrAmount(proposalSource.fundingNeeded)}` : ''}. Would you be interested in learning more?`,
        `Hello! I'm building **${proposalSource.name}** - ${proposalSource.tagline}. I believe this aligns with your investment interest. Would you have time for a quick call?`,
        `Hi! I'm the founder behind **${proposalSource.name}**${proposalSource.category ? ` in the ${proposalSource.category} space` : ''}. We'd love to discuss an investment partnership. Are you open to connecting?`,
      ]
    : [];

  const handleSend = (message: string) => {
    if (!message.trim()) return;
    onSend(message);
    onClose();
    setCustomNote('');
    setSelectedProjectId(null);
    setSelectedStartupId(preferredStartupId ?? null);
  };

  const handleClose = () => {
    onClose();
    setCustomNote('');
    setSelectedProjectId(null);
    setSelectedStartupId(preferredStartupId ?? null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Investment Proposal</h2>
              <p className="text-sm text-slate-400">
                {showSourcePicker
                  ? `Choose a startup or project to pitch to ${recipientName}`
                  : `Pitch your ${proposalSource?.kindLabel ?? 'startup'} to ${recipientName}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : !isStudent ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">
                Associate {recipientName} as an investor for your deal flow:
              </p>
              {[
                `Hi! I would like to formally associate you as an Investor on my platform profile. I believe our interests align well.`,
                `Hello! I'd love to have you as an investor partner. Would you be open to discussing collaboration opportunities?`,
                `Hi! I'm reaching out to explore investment opportunities together. Would you be interested in connecting?`,
              ].map((msg, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(msg)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-left text-sm text-slate-300 transition hover:border-emerald-500/50 hover:bg-slate-800"
                >
                  {msg}
                </button>
              ))}
              <div className="space-y-2 border-t border-slate-700 pt-3">
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Write a custom message..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none transition focus:border-emerald-500 placeholder:text-slate-500"
                />
                <button
                  onClick={() => handleSend(customNote)}
                  disabled={!customNote.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
              </div>
            </div>
          ) : showSourcePicker ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Select a pitch source</h3>
                    <p className="text-sm text-slate-400">
                      Choose the startup or project you want to pitch to {recipientName}.
                    </p>
                  </div>
                </div>
              </div>

              {startupOptions.map((startup) => (
                <button
                  key={startup._id}
                  onClick={() => {
                    setSelectedStartupId(startup._id);
                    setSelectedProjectId(null);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-left transition hover:border-emerald-500/40 hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-emerald-300" />
                        <div className="text-base font-semibold text-white">{startup.name}</div>
                      </div>
                      <div className="mt-1 text-sm text-slate-400">{startup.tagline}</div>
                    </div>
                    <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200">
                      {startup.stage}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-slate-300">
                      {startup.category || 'Innovation'}
                    </span>
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-slate-300">
                      Team {startup.teamSize}
                    </span>
                  </div>
                </button>
              ))}

              {projects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => {
                    setSelectedProjectId(project._id);
                    setSelectedStartupId(null);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-left transition hover:border-emerald-500/40 hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-white">{project.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{project.category}</div>
                    </div>
                    <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200">
                      {project.stage}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-slate-300">
                      Team {getProjectTeamSize(project)}
                    </span>
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-slate-300">
                      Progress {project.progressPercent ?? 0}%
                    </span>
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-slate-300">
                      {project.milestones.length} milestones
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : !proposalSource ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-500">
                <Rocket className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No pitch source found</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Create a startup or project before pitching to investors.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Open <strong>Product Workspace</strong> or <strong>Startup Launch</strong> to
                  prepare a project for investor outreach.
                </span>
              </div>
            </div>
          ) : (
            <>
              {canChooseSource ? (
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setSelectedStartupId(null);
                  }}
                  className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to source list
                </button>
              ) : null}

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-white">{proposalSource.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[proposalSource.stage] ?? 'text-slate-400 bg-slate-700'}`}
                      >
                        {proposalSource.stage}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-slate-400">{proposalSource.tagline}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Category: <span className="text-slate-400">{proposalSource.category || 'N/A'}</span>
                    </p>
                    {selectedProject ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Project: <span className="text-slate-400">{selectedProject.title}</span>
                      </p>
                    ) : null}
                  </div>
                  {proposalSource.pitchDeckUrl ? (
                    <a
                      href={proposalSource.pitchDeckUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Pitch Deck
                    </a>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {proposalSource.fundingNeeded ? (
                    <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs">
                      <span className="text-slate-400">Seeking </span>
                      <span className="font-semibold text-white">
                        {formatInrAmount(proposalSource.fundingNeeded)}
                      </span>
                    </div>
                  ) : null}
                  <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs">
                    <span className="text-slate-400">Team: </span>
                    <span className="font-semibold text-white">{proposalSource.teamSize}</span>
                  </div>
                  {proposalSource.traction.mvpBuilt ? (
                    <div className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400">
                      MVP Built
                    </div>
                  ) : null}
                  {proposalSource.traction.revenueGenerating ? (
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
                      Revenue Generating
                    </div>
                  ) : null}
                  {proposalSource.traction.patentFiled ? (
                    <div className="rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400">
                      Patent Filed
                    </div>
                  ) : null}
                  {proposalSource.traction.usersCount ? (
                    <div className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs">
                      <span className="font-semibold text-white">
                        {proposalSource.traction.usersCount.toLocaleString()}
                      </span>
                      <span className="text-slate-400"> users</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-300">Quick pitch messages:</p>
                <div className="space-y-2">
                  {quickMessages.map((msg, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(msg)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-left text-sm text-slate-300 transition hover:border-emerald-500/50 hover:bg-slate-800"
                    >
                      {msg.replace(/\*\*/g, '')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-700 pt-4">
                <p className="text-sm font-medium text-slate-300">
                  Or send a full proposal with project details:
                </p>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Add a personal note (optional)..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none transition focus:border-emerald-500 placeholder:text-slate-500"
                />
                <button
                  onClick={() => handleSend(buildFullProposal(proposalSource, customNote))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                  Send Full Proposal with Project Details
                </button>
                <p className="text-center text-xs text-slate-500">
                  Shares your selected project's stage, team details, traction, and pitch deck with {recipientName}.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface InvestorProposalReplyProps {
  senderName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function InvestorProposalReplyActions({ senderName, onAccept, onDecline }: InvestorProposalReplyProps) {
  return (
    <div className="mt-3 flex w-full flex-wrap gap-2">
      <button
        onClick={onAccept}
        aria-label={`Show interest in ${senderName}'s pitch`}
        className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Interested
      </button>
      <button
        onClick={onDecline}
        aria-label={`Pass on ${senderName}'s pitch`}
        className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
      >
        <XCircle className="h-3.5 w-3.5" />
        Pass
      </button>
    </div>
  );
}
