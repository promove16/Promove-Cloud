import { ChangeEvent, ElementType, FormEvent, useMemo, useState } from 'react';
import { AlertCircle, Copy, FileSpreadsheet, ShieldCheck, Upload, UserPlus, X, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { BulkCredentialImportResult, TemporaryStudentCredentials, StudentRosterEntry } from '../../types/school.types';

const rosterTone: Record<StudentRosterEntry['status'], string> = {
  invited: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  registered_pending: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

const sourceLabel: Record<StudentRosterEntry['source'], string> = {
  manual: 'Manual',
  csv: 'CSV Import',
  xlsx: 'Excel Import',
};

type Tab = 'add' | 'import' | 'credentials' | 'roster';

type StudentIntakePanelProps = {
  heading: string;
  description: string;
  secondaryFieldLabel: string;
  secondaryFieldPlaceholder: string;
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
  }) => void;
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

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreateManualEntry({
      displayName: manualForm.displayName.trim(),
      email: manualForm.email.trim(),
      ...(manualForm.secondaryLabel.trim() ? { gradeOrProgram: manualForm.secondaryLabel.trim() } : {}),
      ...(manualForm.rollNumber.trim() ? { rollNumber: manualForm.rollNumber.trim() } : {}),
      ...(manualForm.notes.trim() ? { notes: manualForm.notes.trim() } : {}),
    });
    setManualForm({ displayName: '', email: '', secondaryLabel: '', rollNumber: '', notes: '' });
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

  const tabs: { id: Tab; label: string; icon: ElementType }[] = [
    { id: 'add', label: 'Add Student', icon: UserPlus },
    { id: 'import', label: 'Import Roster', icon: FileSpreadsheet },
    { id: 'credentials', label: 'Temp Login', icon: ShieldCheck },
    { id: 'roster', label: `Roster (${roster.length})`, icon: Users },
  ];

  return (
    <>
      {/* Compact trigger row */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Student Onboarding</span>
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="font-semibold text-cyan-300">{summary.invited}</span>
              <span className="ml-1.5 text-slate-500">invited</span>
            </span>
            <span>
              <span className="font-semibold text-amber-300">{summary.registeredPending}</span>
              <span className="ml-1.5 text-slate-500">pending</span>
            </span>
            <span>
              <span className="font-semibold text-emerald-300">{summary.verified}</span>
              <span className="ml-1.5 text-slate-500">verified</span>
            </span>
          </div>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Manage Students
        </Button>
      </div>

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
            <div className="flex border-b border-slate-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 flex-col items-center gap-1 px-2 py-3 text-xs transition ${
                    activeTab === tab.id
                      ? 'border-b-2 border-cyan-400 text-cyan-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

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
                    {isManualSubmitting ? 'Saving...' : 'Add Student'}
                  </Button>
                </form>
              )}

              {/* Import Roster */}
              {activeTab === 'import' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Import a CSV or Excel spreadsheet with columns: <span className="text-slate-300">displayName</span>,{' '}
                    <span className="text-slate-300">email</span>,{' '}
                    <span className="text-slate-300">{secondaryFieldLabel.toLowerCase()}</span>,{' '}
                    <span className="text-slate-300">rollNumber</span>.
                  </p>

                  {/* Toggle: with or without credentials */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
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
                        Email must match your institution domain.
                      </div>
                    </div>
                  </label>

                  <label className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition ${withCredentials ? 'border-cyan-500/50 bg-cyan-500/5 hover:border-cyan-400/60' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-500/40'}`}>
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
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
                      {lastImportMessage}
                    </div>
                  )}

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

                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                        Save these passwords now — they cannot be retrieved again. Students must change their password on first login.
                      </div>

                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {bulkCredentialResult.results.map((r) => (
                          <div key={r.student._id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
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
                            <div key={e.row} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
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
                        { label: 'Pending', value: summary.registeredPending, color: 'text-amber-300' },
                        { label: 'Verified', value: summary.verified, color: 'text-emerald-300' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-center">
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
                    Create a one-time password using a verified institutional email. The student should change it after first sign-in.
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
                      ? `Use @${institutionDomainHint} domain. Generated password is shown once.`
                      : 'Use a school or college email domain you control. Password is shown once.'}
                  </div>
                  <Button type="submit" disabled={isTemporaryCredentialSubmitting} className="w-full">
                    {isTemporaryCredentialSubmitting ? 'Creating...' : 'Create Temporary Login'}
                  </Button>

                  {temporaryCredential && (
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Credential issued</div>
                      <div className="mt-3 space-y-2">
                        <div className="text-sm font-semibold text-white">{temporaryCredential.student.displayName}</div>
                        <div className="text-xs text-cyan-50/70">{temporaryCredential.student.email}</div>
                        <div className="mt-2 break-all rounded-lg border border-cyan-500/20 bg-slate-950 px-3 py-2 font-mono text-sm font-semibold text-white">
                          {temporaryCredential.temporaryPassword}
                        </div>
                        <div className="text-xs text-cyan-50/60">Share once — student must change on first login.</div>
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
                      No students added yet. Use "Add Student" or "Import Roster" to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roster.map((entry) => (
                        <div
                          key={entry._id}
                          className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{entry.displayName}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">{entry.email}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-xs ${rosterTone[entry.status]}`}>
                                  {entry.status.replace(/_/g, ' ')}
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
                              <div className="mt-0.5">{entry.linkedUserId ? 'Matched' : 'Pending'}</div>
                              {onCancelInvite && entry.status === 'invited' && !entry.linkedUserId ? (
                                <button
                                  type="button"
                                  onClick={() => onCancelInvite(entry._id)}
                                  disabled={cancellingInviteId === entry._id}
                                  className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {cancellingInviteId === entry._id ? 'Cancelling...' : 'Cancel Invite'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {entry.notes && (
                            <div className="mt-2 text-xs text-slate-500">{entry.notes}</div>
                          )}
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
