import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Copy,
  GraduationCap,
  Landmark,
  Rocket,
  School,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type AdminOnboardAccountInput, type AdminUserListItem } from '../../api/admin.api';
import { UserRole } from '../../types/roles.types';
import type {
  BulkCredentialImportResult,
  StudentRosterEntry,
  TemporaryStudentCredentials,
} from '../../types/school.types';
import { Button } from '../../components/ui/Button';
import { InstitutionSearchField } from './InstitutionSearchField';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';
import { formLabelClassName, getInstitutionLabel } from './mentorshipAdminShared';
import UserRequests from './UserRequests';

type OnboardRole =
  | UserRole.STUDENT
  | UserRole.MENTOR
  | UserRole.INVESTOR
  | UserRole.RECRUITER
  | UserRole.SCHOOL
  | UserRole.COLLEGE;

type RoleMeta = {
  label: string;
  blurb: string;
  icon: LucideIcon;
  kind: 'student' | 'staff' | 'institution';
};

const ROLE_META: Record<OnboardRole, RoleMeta> = {
  [UserRole.STUDENT]: {
    label: 'Student',
    blurb: 'Add to a school or college roster',
    icon: Users,
    kind: 'student',
  },
  [UserRole.INVESTOR]: {
    label: 'Investor',
    blurb: 'Create a funding partner account',
    icon: TrendingUp,
    kind: 'staff',
  },
  [UserRole.RECRUITER]: {
    label: 'Recruiter',
    blurb: 'Create a hiring partner account',
    icon: Briefcase,
    kind: 'staff',
  },
  [UserRole.MENTOR]: {
    label: 'Mentor',
    blurb: 'Create a mentor profile',
    icon: GraduationCap,
    kind: 'staff',
  },
  [UserRole.SCHOOL]: {
    label: 'School',
    blurb: 'Onboard a school institution',
    icon: School,
    kind: 'institution',
  },
  [UserRole.COLLEGE]: {
    label: 'College',
    blurb: 'Onboard a college institution',
    icon: Landmark,
    kind: 'institution',
  },
};

const ROLE_ORDER: OnboardRole[] = [
  UserRole.STUDENT,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
  UserRole.MENTOR,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
];

const inputCls =
  'w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none';

const emailDomain = (email?: string) => email?.trim().toLowerCase().split('@')[1] ?? '';

// ── Credential reveal ─────────────────────────────────────────────────────────

function CredentialCard({
  title,
  name,
  email,
  password,
}: {
  title: string;
  name: string;
  email: string;
  password: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{name}</div>
      <div className="text-xs text-emerald-100/70">{email}</div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-slate-950 px-3 py-2">
        <span className="break-all font-mono text-sm font-semibold text-cyan-300">{password}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(password);
            toast.success('Temporary password copied');
          }}
          className="shrink-0 rounded p-1 text-slate-400 transition hover:text-white"
          title="Copy password"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-xs text-emerald-100/70">
        Share these credentials securely. The account must reset its password on first login.
      </p>
    </div>
  );
}

// ── Staff onboarding (mentor / investor / recruiter) ──────────────────────────

function StaffOnboardingForm({ role }: { role: UserRole.MENTOR | UserRole.INVESTOR | UserRole.RECRUITER }) {
  const meta = ROLE_META[role];
  const [form, setForm] = useState({ displayName: '', email: '', domain: '', headline: '', bio: '' });
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: AdminOnboardAccountInput) => adminApi.onboardAccount(payload),
    onSuccess: (result) => {
      setCreated({
        name: result.user.displayName,
        email: result.user.email,
        password: result.temporaryPassword,
      });
      setForm({ displayName: '', email: '', domain: '', headline: '', bio: '' });
      toast.success(`${meta.label} account created`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : `Could not create ${meta.label.toLowerCase()} account`);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      role,
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      domain: form.domain.trim(),
      ...(form.headline.trim() ? { headline: form.headline.trim() } : {}),
      ...(form.bio.trim() ? { bio: form.bio.trim() } : {}),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <label className={formLabelClassName}>{meta.label} name</label>
          <input
            value={form.displayName}
            onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
            placeholder={`Enter the ${meta.label.toLowerCase()}'s full name`}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={formLabelClassName}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
            placeholder="name@company.com"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={formLabelClassName}>Domain / Focus area</label>
          <input
            value={form.domain}
            onChange={(e) => setForm((c) => ({ ...c, domain: e.target.value }))}
            placeholder={
              role === UserRole.INVESTOR
                ? 'Example: Seed-stage deep tech, fintech'
                : role === UserRole.RECRUITER
                  ? 'Example: Campus hiring, SDE roles'
                  : 'Example: Product strategy, AI, finance'
            }
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={formLabelClassName}>Headline</label>
          <input
            value={form.headline}
            onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
            placeholder="Short professional headline (optional)"
            className={inputCls}
          />
        </div>
        <div>
          <label className={formLabelClassName}>Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
            placeholder="Short background (optional)"
            className={`${inputCls} min-h-28 resize-none`}
          />
        </div>
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          {mutation.isPending ? 'Creating account...' : `Create ${meta.label} Account`}
        </Button>
      </form>

      <div className="space-y-4">
        {created ? (
          <CredentialCard
            title="Account created"
            name={created.name}
            email={created.email}
            password={created.password}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Direct onboarding
            </div>
            <p className="mt-3">
              The account is created instantly and approved. A temporary password is generated here for
              you to hand over — the {meta.label.toLowerCase()} must reset it on first login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Institution onboarding (school / college) ─────────────────────────────────

function InstitutionOnboardingForm({ role }: { role: UserRole.SCHOOL | UserRole.COLLEGE }) {
  const meta = ROLE_META[role];
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    institutionName: '',
    location: '',
    totalStudentsEnrolled: '',
    academicYear: '',
    organizationType: '',
    contactPhone: '',
  });
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: AdminOnboardAccountInput) => adminApi.onboardAccount(payload),
    onSuccess: (result) => {
      setCreated({
        name: result.user.institutionName ?? result.user.displayName,
        email: result.user.email,
        password: result.temporaryPassword,
      });
      setForm({
        displayName: '',
        email: '',
        institutionName: '',
        location: '',
        totalStudentsEnrolled: '',
        academicYear: '',
        organizationType: '',
        contactPhone: '',
      });
      toast.success(`${meta.label} onboarded`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : `Could not onboard ${meta.label.toLowerCase()}`);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const enrolled = Number.parseInt(form.totalStudentsEnrolled, 10);
    mutation.mutate({
      role,
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      institutionProfile: {
        ...(form.institutionName.trim() ? { institutionName: form.institutionName.trim() } : {}),
        location: form.location.trim(),
        ...(Number.isFinite(enrolled) ? { totalStudentsEnrolled: enrolled } : {}),
        ...(form.academicYear.trim() ? { academicYear: form.academicYear.trim() } : {}),
        ...(form.organizationType.trim() ? { organizationType: form.organizationType.trim() } : {}),
        ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
      },
    });
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className={formLabelClassName}>Admin contact name</label>
            <input
              value={form.displayName}
              onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
              placeholder="Primary account holder"
              className={inputCls}
              required
            />
          </div>
          <div className="min-w-0">
            <label className={formLabelClassName}>Login email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder={`admin@${role === UserRole.SCHOOL ? 'school' : 'college'}.edu`}
              className={inputCls}
              required
            />
          </div>
        </div>
        <div>
          <label className={formLabelClassName}>{meta.label} name</label>
          <input
            value={form.institutionName}
            onChange={(e) => setForm((c) => ({ ...c, institutionName: e.target.value }))}
            placeholder={`Official ${meta.label.toLowerCase()} name`}
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className={formLabelClassName}>Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
              placeholder="City, State"
              className={inputCls}
              required
            />
          </div>
          <div className="min-w-0">
            <label className={formLabelClassName}>Students enrolled</label>
            <input
              type="number"
              min={0}
              value={form.totalStudentsEnrolled}
              onChange={(e) => setForm((c) => ({ ...c, totalStudentsEnrolled: e.target.value }))}
              placeholder="e.g. 1200"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label className={formLabelClassName}>Academic year</label>
            <input
              value={form.academicYear}
              onChange={(e) => setForm((c) => ({ ...c, academicYear: e.target.value }))}
              placeholder="2025-2026"
              className={inputCls}
            />
          </div>
          <div className="min-w-0">
            <label className={formLabelClassName}>Organization type</label>
            <input
              value={form.organizationType}
              onChange={(e) => setForm((c) => ({ ...c, organizationType: e.target.value }))}
              placeholder="e.g. Private, Government"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={formLabelClassName}>Contact phone</label>
          <input
            value={form.contactPhone}
            onChange={(e) => setForm((c) => ({ ...c, contactPhone: e.target.value }))}
            placeholder="Optional"
            className={inputCls}
          />
        </div>
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          <Building2 className="mr-2 h-4 w-4" />
          {mutation.isPending ? 'Onboarding...' : `Onboard ${meta.label}`}
        </Button>
      </form>

      <div className="space-y-4">
        {created ? (
          <CredentialCard
            title={`${meta.label} onboarded`}
            name={created.name}
            email={created.email}
            password={created.password}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Verified on creation
            </div>
            <p className="mt-3">
              Admin-created institutions are marked verified and active immediately. Once onboarded, the{' '}
              {meta.label.toLowerCase()} can sign in and start adding students from their own dashboard or
              from the Student tab here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student onboarding (per selected institution) ─────────────────────────────

function StudentOnboardingSection() {
  const queryClient = useQueryClient();
  const [institutionId, setInstitutionId] = useState('');
  const [temporaryCredential, setTemporaryCredential] = useState<TemporaryStudentCredentials | null>(null);
  const [bulkCredentialResult, setBulkCredentialResult] = useState<BulkCredentialImportResult | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const institutionsQuery = useQuery({
    queryKey: ['admin-onboarding-institutions'],
    queryFn: async () => {
      const [schools, colleges] = await Promise.all([
        adminApi.getUsers({ role: UserRole.SCHOOL, limit: 200 }),
        adminApi.getUsers({ role: UserRole.COLLEGE, limit: 200 }),
      ]);
      return [...schools.items, ...colleges.items];
    },
  });

  const institutions = institutionsQuery.data ?? [];
  const selectedInstitution = useMemo<AdminUserListItem | null>(
    () => institutions.find((institution) => institution._id === institutionId) ?? null,
    [institutions, institutionId],
  );

  const rosterQuery = useQuery({
    queryKey: ['admin-institution-roster', institutionId],
    queryFn: () => adminApi.getInstitutionRoster(institutionId),
    enabled: Boolean(institutionId),
  });

  const invalidateRoster = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-institution-roster', institutionId] });

  const manualMutation = useMutation({
    mutationFn: (payload: {
      displayName: string;
      email: string;
      gradeOrProgram?: string;
      rollNumber?: string;
      notes?: string;
    }) => adminApi.createInstitutionRosterEntry(institutionId, payload),
    onSuccess: async () => {
      toast.success('Student added to roster');
      await invalidateRoster();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not add student');
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => adminApi.importInstitutionRoster(institutionId, file),
    onSuccess: async (result) => {
      toast.success(`Imported ${result.created} new and updated ${result.updated} students`);
      await invalidateRoster();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Roster import failed');
    },
  });

  const importCredentialsMutation = useMutation({
    mutationFn: (file: File) => adminApi.importInstitutionRosterWithCredentials(institutionId, file),
    onSuccess: async (result) => {
      setBulkCredentialResult(result);
      toast.success(`Created ${result.results.length} student logins`);
      await invalidateRoster();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Bulk login creation failed');
    },
  });

  const temporaryCredentialMutation = useMutation({
    mutationFn: (payload: {
      displayName: string;
      email: string;
      domain?: string;
      bio?: string;
      gradeOrProgram?: string;
      rollNumber?: string;
      notes?: string;
    }) => adminApi.createInstitutionStudentCredentials(institutionId, payload),
    onSuccess: async (result) => {
      setTemporaryCredential(result);
      toast.success('Temporary login created');
      await invalidateRoster();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not create temporary login');
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (rosterEntryId: string) =>
      adminApi.cancelInstitutionRosterInvite(institutionId, rosterEntryId),
    onMutate: (rosterEntryId: string) => setCancellingInviteId(rosterEntryId),
    onSuccess: async () => {
      toast.success('Invite cancelled');
      await invalidateRoster();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not cancel invite');
    },
    onSettled: () => setCancellingInviteId(null),
  });

  const isSchool = selectedInstitution?.role === UserRole.SCHOOL;
  const secondaryFieldLabel = isSchool ? 'Grade / Class' : 'Program / Year';
  const secondaryFieldPlaceholder = isSchool ? 'Class 10, Section A' : 'B.Tech CSE, 2nd year';
  const institutionDomainHint = emailDomain(selectedInstitution?.email);
  const roster: StudentRosterEntry[] = rosterQuery.data?.entries ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Building2 className="h-4 w-4 text-cyan-300" />
          Select Institution
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Choose the school or college whose roster you want to manage, then add or import students.
        </p>
        <div className="mt-4">
          {institutionsQuery.isLoading ? (
            <div className="rounded-lg border border-dashed border-slate-800 px-4 py-3 text-sm text-slate-400">
              Loading institutions...
            </div>
          ) : (
            <InstitutionSearchField
              institutions={institutions}
              value={institutionId}
              onChange={(next) => {
                setInstitutionId(next);
                setTemporaryCredential(null);
                setBulkCredentialResult(null);
              }}
              label="Institution"
              placeholder="Search school or college by name, location, or email"
              helperText="Only schools and colleges are listed. Type to search."
            />
          )}
        </div>
      </div>

      {selectedInstitution ? (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                {selectedInstitution.role === UserRole.SCHOOL ? 'School' : 'College'} roster
              </div>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {getInstitutionLabel(selectedInstitution)}
              </h3>
              <div className="text-xs text-slate-400">{selectedInstitution.email}</div>
            </div>
          </div>
          <StudentIntakePanel
            heading={`Onboard students for ${getInstitutionLabel(selectedInstitution)}`}
            description="Add a single student or import a roster. Invites and temporary logins are emailed automatically."
            secondaryFieldLabel={secondaryFieldLabel}
            secondaryFieldPlaceholder={secondaryFieldPlaceholder}
            roster={roster}
            institutionDomainHint={institutionDomainHint}
            isRosterLoading={rosterQuery.isLoading}
            isManualSubmitting={manualMutation.isPending}
            isImportSubmitting={importMutation.isPending}
            isImportWithCredentialsSubmitting={importCredentialsMutation.isPending}
            isTemporaryCredentialSubmitting={temporaryCredentialMutation.isPending}
            temporaryCredential={temporaryCredential}
            bulkCredentialResult={bulkCredentialResult}
            cancellingInviteId={cancellingInviteId}
            onCreateManualEntry={(payload) => manualMutation.mutateAsync(payload)}
            onImportFile={(file) => importMutation.mutate(file)}
            onImportFileWithCredentials={(file) => importCredentialsMutation.mutate(file)}
            onCreateTemporaryCredentials={(payload) => temporaryCredentialMutation.mutate(payload)}
            onCancelInvite={(rosterEntryId) => cancelInviteMutation.mutate(rosterEntryId)}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-6 py-12 text-center text-sm text-slate-400">
          Select a school or college above to manage their student roster.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingAccounts() {
  const [role, setRole] = useState<OnboardRole>(UserRole.STUDENT);
  const meta = ROLE_META[role];
  const isInstitutionRole = meta.kind === 'institution';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Onboard a new account</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Onboard any role into ProMove from one place — students, investors, recruiters, mentors,
          schools and colleges. Pick a role to get started.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ROLE_ORDER.map((roleKey) => {
          const item = ROLE_META[roleKey];
          const Icon = item.icon;
          const active = role === roleKey;
          return (
            <button
              key={roleKey}
              type="button"
              onClick={() => setRole(roleKey)}
              className={`flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition ${
                active
                  ? 'border-cyan-500/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className={`block text-sm font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{item.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`grid gap-8 ${
          isInstitutionRole
            ? '2xl:grid-cols-[minmax(0,1fr)_minmax(26rem,30rem)]'
            : 'xl:grid-cols-2'
        }`}
      >
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
            <Rocket className="h-4 w-4 text-cyan-300" />
            <span className="font-semibold text-white">{meta.label}</span>
            <span className="text-slate-500">· {meta.blurb}</span>
          </div>

          {meta.kind === 'student' ? (
            <StudentOnboardingSection />
          ) : meta.kind === 'institution' ? (
            <InstitutionOnboardingForm role={role as UserRole.SCHOOL | UserRole.COLLEGE} />
          ) : (
            <StaffOnboardingForm role={role as UserRole.MENTOR | UserRole.INVESTOR | UserRole.RECRUITER} />
          )}
        </div>

        <div
          className={`space-y-4 ${
            isInstitutionRole
              ? '2xl:border-l 2xl:border-slate-800/80 2xl:pl-8'
              : 'xl:border-l xl:border-slate-800/80 xl:pl-8'
          }`}
        >
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-5 py-4 text-sm text-slate-400">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Direct requests
            </div>
            <p className="mt-2">
              Direct {meta.label.toLowerCase()} requests will show here for admin review. Accounts
              created from the form are approved immediately and skip this queue.
            </p>
          </div>
          <UserRequests roleFilter={role} />
        </div>
      </div>
    </div>
  );
}
