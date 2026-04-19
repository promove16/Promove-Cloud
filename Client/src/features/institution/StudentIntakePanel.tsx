import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Copy, Download, FileSpreadsheet, Info, ShieldCheck, Upload, UserPlus, X, Users, type LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { BulkCredentialImportResult, TemporaryStudentCredentials, StudentRosterEntry } from '../../types/school.types';

const rosterTone: Record<StudentRosterEntry['status'], string> = {
  invited: 'border-cyan-700 bg-cyan-900 text-cyan-200',
  registered_pending: 'border-amber-700 bg-amber-900 text-amber-200',
  verified: 'border-emerald-700 bg-emerald-900 text-emerald-200',
  rejected: 'border-rose-700 bg-rose-900 text-rose-200',
};

const sourceLabel: Record<StudentRosterEntry['source'], string> = {
  manual: 'Manual',
  csv: 'CSV Import',
  xlsx: 'Excel Import',
};

const rosterStatusLabel: Record<StudentRosterEntry['status'], string> = {
  invited: 'Invite sent',
  registered_pending: 'Registered, awaiting review',
  verified: 'Verified',
  rejected: 'Rejected',
};

const rosterStatusExplanation = (entry: StudentRosterEntry) => {
  switch (entry.status) {
    case 'invited':
      return 'The roster entry exists, but the student has not completed registration yet.';
    case 'registered_pending':
      return 'The student has registered against this roster entry and still needs the institution workflow to finish.';
    case 'verified':
      return 'Institution review is complete and the student is active on the managed roster.';
    case 'rejected':
      return 'The institution rejected this linked registration.';
    default:
      return '';
  }
};

type Tab = 'add' | 'import' | 'credentials' | 'roster';

type StudentIntakePanelProps = {
  heading: string;
  description: string;
  secondaryFieldLabel: string;
  secondaryFieldPlaceholder: string;
  compactTrigger?: boolean;
  triggerLabel?: string;
  showContextNote?: boolean;
  roster: StudentRosterEntry[];
  institutionDomainHint?: string;
  isRosterLoading?: boolean;
  isManualSubmitting?: boolean;
  isImportSubmitting?: boolean;
  isTemporaryCredentialSubmitting?: boolean;
  temporaryCredential?: TemporaryStudentCredentials | null;
  onCreateManualEntry: (payload: {
    displayName: string;
    email: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  }) => Promise<StudentRosterEntry>;
  onCancelInvite?: (rosterEntryId: string) => void;
  cancellingInviteId?: string | null;
  isImportWithCredentialsSubmitting?: boolean;
  bulkCredentialResult?: BulkCredentialImportResult | null;
  onImportFile: (file: File) => void;
  onImportFileWithCredentials: (file: File) => void;
  onCreateTemporaryCredentials: (payload: {
    displayName: string;
    email: string;
    domain?: string;
    bio?: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  }) => void;
};

const inputCls =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none';

export function StudentIntakePanel({
  heading,
  description,
  secondaryFieldLabel,
  secondaryFieldPlaceholder,
  compactTrigger = false,
  triggerLabel = 'Manage Students',
  showContextNote = true,
  roster,
  institutionDomainHint,
  isRosterLoading,
  isManualSubmitting,
  isImportSubmitting,
  isImportWithCredentialsSubmitting,
  isTemporaryCredentialSubmitting,
  temporaryCredential,
  bulkCredentialResult,
  onCreateManualEntry,
  onCancelInvite,
  cancellingInviteId,
  onImportFile,
  onImportFileWithCredentials,
  onCreateTemporaryCredentials,
}: StudentIntakePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const [isHelperOpen, setIsHelperOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    displayName: '',
    email: '',
    secondaryLabel: '',
    rollNumber: '',
    notes: '',
  });
  const [temporaryForm, setTemporaryForm] = useState({
    displayName: '',
    email: '',
    domain: '',
    bio: '',
    secondaryLabel: '',
    rollNumber: '',
    notes: '',
  });
  const [lastImportMessage, setLastImportMessage] = useState('');
  const [withCredentials, setWithCredentials] = useState(false);

  const summary = useMemo(
    () => ({
      invited: roster.filter((e) => e.status === 'invited').length,
      registeredPending: roster.filter((e) => e.status === 'registered_pending').length,
      verified: roster.filter((e) => e.status === 'verified').length,
    }),
    [roster],
  );

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await onCreateManualEntry({
        displayName: manualForm.displayName.trim(),
        email: manualForm.email.trim(),
        ...(manualForm.secondaryLabel.trim() ? { gradeOrProgram: manualForm.secondaryLabel.trim() } : {}),
        ...(manualForm.rollNumber.trim() ? { rollNumber: manualForm.rollNumber.trim() } : {}),
        ...(manualForm.notes.trim() ? { notes: manualForm.notes.trim() } : {}),
      });
      setManualForm({ displayName: '', email: '', secondaryLabel: '', rollNumber: '', notes: '' });
    } catch {
      // Keep the form data in place so the user can correct and resubmit.
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (withCredentials) {
      onImportFileWithCredentials(file);
    } else {
      onImportFile(file);
    }
    setLastImportMessage(withCredentials ? `Creating accounts for students in ${file.name}...` : `${file.name} queued for import`);
    event.target.value = '';
  };

  const handleTemporarySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreateTemporaryCredentials({
      displayName: temporaryForm.displayName.trim(),
      email: temporaryForm.email.trim(),
      ...(temporaryForm.domain.trim() ? { domain: temporaryForm.domain.trim() } : {}),
      ...(temporaryForm.bio.trim() ? { bio: temporaryForm.bio.trim() } : {}),
      ...(temporaryForm.secondaryLabel.trim() ? { gradeOrProgram: temporaryForm.secondaryLabel.trim() } : {}),
      ...(temporaryForm.rollNumber.trim() ? { rollNumber: temporaryForm.rollNumber.trim() } : {}),
      ...(temporaryForm.notes.trim() ? { notes: temporaryForm.notes.trim() } : {}),
    });
    setTemporaryForm({ displayName: '', email: '', domain: '', bio: '', secondaryLabel: '', rollNumber: '', notes: '' });
  };

  const fieldGuide = [
    {
      label: 'Display Name',
      required: true,
      accepted: ['displayName', 'name', 'studentName', 'student_name', 'fullName', 'full_name'],
      description: 'Full name of the student (2–120 characters)',
    },
    {
      label: 'Email',
      required: true,
      accepted: ['email', 'emailAddress', 'email_address', 'studentEmail', 'student_email', 'gmail'],
      description: withCredentials
        ? `Institutional email. Must end with your institution's domain (e.g. @school.edu)`
        : 'Student email address',
    },
    {
      label: secondaryFieldLabel,
      required: false,
      accepted: ['grade', 'program', 'course', 'class', 'department', 'gradeOrProgram'],
      description: `Class, year, or program — e.g. "Class 10", "B.Tech CSE" (optional, max 120 chars)`,
    },
    {
      label: 'Roll Number',
      required: false,
      accepted: ['rollNumber', 'roll_number', 'rollNo', 'rollno', 'studentId', 'student_id'],
      description: 'Student roll number, ID, or registration number (optional, max 80 chars)',
    },
    {
      label: 'Notes',
      required: false,
      accepted: ['notes', 'remarks', 'comment', 'comments'],
      description: 'Optional section info or onboarding remarks (max 300 chars)',
    },
  ];

  const handleDownloadTemplate = () => {
    const header = ['displayName', 'email', secondaryFieldLabel.toLowerCase().replace(/\s+/g, ''), 'rollNumber', 'notes'];
    const sampleRow = [
      'Arjun Sharma',
      withCredentials && institutionDomainHint ? `arjun@${institutionDomainHint}` : 'arjun@school.edu',
      secondaryFieldLabel === 'Grade / Class' ? 'Class 10' : 'B.Tech CSE',
      'SCH2024001',
      'Section A',
    ];
    const csv = [header.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_roster_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'add', label: 'Add Student', icon: UserPlus },
    { id: 'import', label: 'Import Roster', icon: FileSpreadsheet },
    { id: 'credentials', label: 'Temp Login', icon: ShieldCheck },
    { id: 'roster', label: `Roster (${roster.length})`, icon: Users },
  ];

  return (
    <>
      {compactTrigger ? (
        <Button
          variant="outline"
          className="border-cyan-700 bg-cyan-900 text-cyan-100 hover:border-cyan-500 hover:bg-cyan-800 hover:text-white"
          onClick={() => setIsOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Student Onboarding</span>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <span className="font-semibold text-cyan-300">{summary.invited}</span>
                  <span className="ml-1.5 text-slate-500">invited</span>
                </span>
                <span>
                  <span className="font-semibold text-amber-300">{summary.registeredPending}</span>
                  <span className="ml-1.5 text-slate-500">awaiting review</span>
                </span>
                <span>
                  <span className="font-semibold text-emerald-300">{summary.verified}</span>
                  <span className="ml-1.5 text-slate-500">verified</span>
                </span>
              </div>
            </div>
            <Button onClick={() => setIsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {triggerLabel}
            </Button>
          </div>
          {showContextNote ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-3 text-sm text-slate-400">
              The roster tracks invite and registration progress. Use the approval queue above for explicit approve or reject actions when they are required.
            </div>
          ) : null}
        </>
      )}

      {/* Sidebar drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative flex h-full w-full max-w-[480px] flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Student Onboarding</div>
                <h2 className="mt-1 text-base font-semibold text-white">{heading}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <OptionTabs
              items={tabs}
              activeId={activeTab}
              onChange={(tabId) => setActiveTab(tabId as Tab)}
              stretch
              aria-label="Student onboarding sections"
            />

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* Add Student */}
              {activeTab === 'add' && (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <p className="text-xs text-slate-500">{description}</p>
                  <input
                    type="text"
                    value={manualForm.displayName}
                    onChange={(e) => setManualForm((c) => ({ ...c, displayName: e.target.value }))}
                    placeholder="Student name"
                    className={inputCls}
                    required
                  />
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm((c) => ({ ...c, email: e.target.value }))}
                    placeholder="student@school.edu"
                    className={inputCls}
                    required
                  />
                  <input
                    type="text"
                    value={manualForm.secondaryLabel}
                    onChange={(e) => setManualForm((c) => ({ ...c, secondaryLabel: e.target.value }))}
                    placeholder={secondaryFieldPlaceholder}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={manualForm.rollNumber}
                    onChange={(e) => setManualForm((c) => ({ ...c, rollNumber: e.target.value }))}
                    placeholder="Roll number or student ID"
                    className={inputCls}
                  />
                  <textarea
                    value={manualForm.notes}
                    onChange={(e) => setManualForm((c) => ({ ...c, notes: e.target.value }))}
                    placeholder="Notes, section, or onboarding context"
                    className={`${inputCls} min-h-[80px] resize-none`}
                  />
                  <Button type="submit" disabled={isManualSubmitting} className="w-full">
                    {isManualSubmitting ? 'Saving...' : 'Add Student Invite'}
                  </Button>
                </form>
              )}

              {/* Import Roster */}
              {activeTab === 'import' && (
                <div className="space-y-4">

                  {/* Column Name Guide */}
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setIsHelperOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                        <Info className="h-3.5 w-3.5 text-cyan-400" />
                        Excel / CSV Column Guide
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-500 transition-transform ${isHelperOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isHelperOpen && (
                      <div className="space-y-4 border-t border-slate-800 px-4 pb-4 pt-3">
                        <p className="text-xs text-slate-500">
                          Name your spreadsheet columns using any of the accepted names below. Column
                          matching is case-insensitive and ignores spaces or underscores.
                        </p>

                        {fieldGuide.map((field) => (
                          <div key={field.label} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">{field.label}</span>
                              {field.required ? (
                                <span className="rounded-full bg-rose-900 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                                  Required
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                                  Optional
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {field.accepted.map((col) => (
                                <code
                                  key={col}
                                  className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300"
                                >
                                  {col}
                                </code>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-500">{field.description}</p>
                          </div>
                        ))}

                        <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            Sample row
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="border-b border-slate-800">
                                  {['displayName', 'email', 'grade', 'rollNumber', 'notes'].map((h) => (
                                    <th key={h} className="pb-1 pr-3 text-left font-mono text-cyan-300">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="pr-3 pt-1 text-slate-300">Arjun Sharma</td>
                                  <td className="pr-3 pt-1 text-slate-300">
                                    {institutionDomainHint
                                      ? `arjun@${institutionDomainHint}`
                                      : 'arjun@school.edu'}
                                  </td>
                                  <td className="pr-3 pt-1 text-slate-300">Class 10</td>
                                  <td className="pr-3 pt-1 text-slate-300">SCH2024001</td>
                                  <td className="pt-1 text-slate-300">Section A</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="flex items-center gap-1.5 text-xs text-cyan-400 transition hover:text-cyan-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download sample template (.csv)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle: with or without credentials */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <div className="relative mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={withCredentials}
                        onChange={(e) => setWithCredentials(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-5 w-9 rounded-full transition ${withCredentials ? 'bg-cyan-500' : 'bg-slate-700'}`}
                      />
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${withCredentials ? 'translate-x-4' : 'translate-x-0.5'}`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Create temporary logins</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        Automatically generate a password for each student. They must change it on first login.
                        The temporary credentials are emailed to each student.
                      </div>
                    </div>
                  </label>

                  <label className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition ${withCredentials ? 'border-cyan-700 bg-cyan-950 hover:border-cyan-500' : 'border-slate-700 bg-slate-900 hover:border-cyan-700'}`}>
                    <Upload className={`h-7 w-7 ${withCredentials ? 'text-cyan-400' : 'text-cyan-300'}`} />
                    <div className="text-sm font-medium text-white">
                      {(isImportSubmitting || isImportWithCredentialsSubmitting) ? 'Processing...' : (withCredentials ? 'Choose file & create logins' : 'Choose roster file')}
                    </div>
                    <div className="text-xs text-slate-500">Supports .csv, .xlsx, .xls</div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isImportSubmitting || isImportWithCredentialsSubmitting}
                    />
                  </label>

                  {lastImportMessage && !bulkCredentialResult && (
                    <div className="rounded-lg border border-cyan-700 bg-cyan-900 px-4 py-3 text-xs text-cyan-100">
                      {lastImportMessage}
                    </div>
                  )}

                  {!bulkCredentialResult && !withCredentials ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
                      Roster imports send email invites automatically. Students who register with the same email move into the institution onboarding flow and should be tracked here until verification is complete.
                    </div>
                  ) : null}

                  {/* Bulk credential results */}
                  {bulkCredentialResult && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                          Credentials Generated
                        </div>
                        <div className="flex gap-3 text-xs text-slate-400">
                          <span className="text-emerald-400">{bulkCredentialResult.results.length} created</span>
                          {bulkCredentialResult.errors.length > 0 && (
                            <span className="text-rose-400">{bulkCredentialResult.errors.length} failed</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-700 bg-amber-900 px-4 py-3 text-xs text-amber-200">
                        These passwords were emailed to students. Save them only if your institution needs a backup handoff.
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {bulkCredentialResult.results.map((r) => (
                          <div key={r.student._id} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">{r.student.displayName}</div>
                                <div className="mt-0.5 truncate text-xs text-slate-400">{r.student.email}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(r.temporaryPassword)}
                                className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-white"
                                title="Copy password"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-2 rounded bg-slate-950 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-300">
                              {r.temporaryPassword}
                            </div>
                          </div>
                        ))}
                      </div>

                      {bulkCredentialResult.errors.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed rows
                          </div>
                          {bulkCredentialResult.errors.map((e) => (
                            <div key={e.row} className="rounded-lg border border-rose-700 bg-rose-900 px-3 py-2 text-xs text-rose-300">
                              Row {e.row}{e.email ? ` (${e.email})` : ''}: {e.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!bulkCredentialResult && (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Invited', value: summary.invited, color: 'text-cyan-300' },
                        { label: 'Awaiting Review', value: summary.registeredPending, color: 'text-amber-300' },
                        { label: 'Verified', value: summary.verified, color: 'text-emerald-300' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-center">
                          <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                          <div className="mt-1 text-xs text-slate-500">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Temporary Credentials */}
              {activeTab === 'credentials' && (
                <form onSubmit={handleTemporarySubmit} className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Create a one-time password using a verified institutional email. The temporary credentials will be emailed to the student.
                  </p>
                  <input
                    type="text"
                    value={temporaryForm.displayName}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, displayName: e.target.value }))}
                    placeholder="Student name"
                    className={inputCls}
                    required
                  />
                  <input
                    type="email"
                    value={temporaryForm.email}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, email: e.target.value }))}
                    placeholder={institutionDomainHint ? `student@${institutionDomainHint}` : 'student@institution.com'}
                    className={inputCls}
                    required
                  />
                  <input
                    type="text"
                    value={temporaryForm.secondaryLabel}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, secondaryLabel: e.target.value }))}
                    placeholder={secondaryFieldPlaceholder}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={temporaryForm.rollNumber}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, rollNumber: e.target.value }))}
                    placeholder="Roll number or student ID"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={temporaryForm.domain}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, domain: e.target.value }))}
                    placeholder="Innovation domain"
                    className={inputCls}
                  />
                  <textarea
                    value={temporaryForm.bio}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, bio: e.target.value }))}
                    placeholder="Short student bio"
                    className={`${inputCls} min-h-[72px] resize-none`}
                  />
                  <textarea
                    value={temporaryForm.notes}
                    onChange={(e) => setTemporaryForm((c) => ({ ...c, notes: e.target.value }))}
                    placeholder="Optional invite notes"
                    className={`${inputCls} min-h-[72px] resize-none`}
                  />
                  <div className="text-xs text-slate-500">
                    {institutionDomainHint
                      ? `Use @${institutionDomainHint} domain. Generated credentials are emailed to the student.`
                      : 'Use a school or college email domain you control. Credentials are emailed to the student.'}
                  </div>
                  <Button type="submit" disabled={isTemporaryCredentialSubmitting} className="w-full">
                    {isTemporaryCredentialSubmitting ? 'Creating...' : 'Create Temporary Login'}
                  </Button>

                  {temporaryCredential && (
                    <div className="rounded-xl border border-cyan-700 bg-cyan-900 p-4">
                      <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Credential issued</div>
                      <div className="mt-3 space-y-2">
                        <div className="text-sm font-semibold text-white">{temporaryCredential.student.displayName}</div>
                        <div className="text-xs text-cyan-50/70">{temporaryCredential.student.email}</div>
                        <div className="mt-2 break-all rounded-lg border border-cyan-700 bg-slate-950 px-3 py-2 font-mono text-sm font-semibold text-white">
                          {temporaryCredential.temporaryPassword}
                        </div>
                        <div className="text-xs text-cyan-50/60">Credentials emailed. Student must change the password on first login.</div>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* Roster */}
              {activeTab === 'roster' && (
                <div>
                  {isRosterLoading ? (
                    <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-400">
                      Loading roster...
                    </div>
                  ) : roster.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
                      No students added yet. Use "Add Student" or "Import Roster" to send invites and build your onboarding list.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roster.map((entry) => (
                        <div
                          key={entry._id}
                          className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{entry.displayName}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">{entry.email}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-xs ${rosterTone[entry.status]}`}>
                                  {rosterStatusLabel[entry.status]}
                                </span>
                                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                                  {sourceLabel[entry.source]}
                                </span>
                                {entry.gradeOrProgram && (
                                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                                    {secondaryFieldLabel}: {entry.gradeOrProgram}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-xs text-slate-500">
                              <div>{new Date(entry.createdAt).toLocaleDateString('en-IN')}</div>
                              <div className="mt-0.5">{entry.linkedUserId ? 'Linked account' : 'No account yet'}</div>
                              {entry.registeredAt ? (
                                <div className="mt-0.5">Registered {new Date(entry.registeredAt).toLocaleDateString('en-IN')}</div>
                              ) : null}
                              {entry.reviewedAt ? (
                                <div className="mt-0.5">Reviewed {new Date(entry.reviewedAt).toLocaleDateString('en-IN')}</div>
                              ) : null}
                              {onCancelInvite && entry.status === 'invited' && !entry.linkedUserId ? (
                                <button
                                  type="button"
                                  onClick={() => onCancelInvite(entry._id)}
                                  disabled={cancellingInviteId === entry._id}
                                  className="mt-3 rounded-md border border-rose-700 bg-rose-900 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-500 hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {cancellingInviteId === entry._id ? 'Cancelling...' : 'Cancel Invite'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {entry.notes && (
                            <div className="mt-2 text-xs text-slate-500">{entry.notes}</div>
                          )}
                          <div className="mt-2 text-xs text-slate-400">
                            {rosterStatusExplanation(entry)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
