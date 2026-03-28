import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { FileSpreadsheet, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StudentRosterEntry } from '../../types/school.types';

const rosterTone: Record<StudentRosterEntry['status'], string> = {
  invited: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  registered_pending: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

type StudentIntakePanelProps = {
  heading: string;
  description: string;
  secondaryFieldLabel: string;
  secondaryFieldPlaceholder: string;
  roster: StudentRosterEntry[];
  isRosterLoading?: boolean;
  isManualSubmitting?: boolean;
  isImportSubmitting?: boolean;
  onCreateManualEntry: (payload: {
    displayName: string;
    email: string;
    gradeOrProgram?: string;
    rollNumber?: string;
    notes?: string;
  }) => void;
  onImportFile: (file: File) => void;
};

const sourceLabel: Record<StudentRosterEntry['source'], string> = {
  manual: 'Manual',
  csv: 'CSV Import',
  xlsx: 'Excel Import',
};

export function StudentIntakePanel({
  heading,
  description,
  secondaryFieldLabel,
  secondaryFieldPlaceholder,
  roster,
  isRosterLoading,
  isManualSubmitting,
  isImportSubmitting,
  onCreateManualEntry,
  onImportFile,
}: StudentIntakePanelProps) {
  const [manualForm, setManualForm] = useState({
    displayName: '',
    email: '',
    secondaryLabel: '',
    rollNumber: '',
    notes: '',
  });
  const [lastImportMessage, setLastImportMessage] = useState('');

  const summary = useMemo(
    () => ({
      invited: roster.filter((entry) => entry.status === 'invited').length,
      registeredPending: roster.filter((entry) => entry.status === 'registered_pending').length,
      verified: roster.filter((entry) => entry.status === 'verified').length,
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
    setManualForm({
      displayName: '',
      email: '',
      secondaryLabel: '',
      rollNumber: '',
      notes: '',
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onImportFile(file);
    setLastImportMessage(`${file.name} queued for import`);
    event.target.value = '';
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Student Intake</div>
            <h2 className="mt-2 text-xl font-semibold text-white">{heading}</h2>
            <p className="mt-2 text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <UserPlus className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={manualForm.displayName}
              onChange={(event) => setManualForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Student name"
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              required
            />
            <input
              type="email"
              value={manualForm.email}
              onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="student@school.edu"
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              required
            />
            <input
              type="text"
              value={manualForm.secondaryLabel}
              onChange={(event) => setManualForm((current) => ({ ...current, secondaryLabel: event.target.value }))}
              placeholder={secondaryFieldPlaceholder}
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <input
              type="text"
              value={manualForm.rollNumber}
              onChange={(event) => setManualForm((current) => ({ ...current, rollNumber: event.target.value }))}
              placeholder="Roll number or student id"
              className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <textarea
            value={manualForm.notes}
            onChange={(event) => setManualForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notes, section, mentor group, or onboarding context"
            className="min-h-[96px] w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Students added here can sign up with this exact email even without a shared token.
            </div>
            <Button type="submit" disabled={isManualSubmitting}>
              {isManualSubmitting ? 'Saving...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Excel Import</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Upload roster file</h2>
            <p className="mt-2 text-sm text-slate-400">
              Import an Excel-compatible CSV or spreadsheet export with columns like `displayName`, `email`,{' '}
              {secondaryFieldLabel.toLowerCase()}, and `rollNumber`.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <FileSpreadsheet className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-6 py-8 text-center transition hover:border-cyan-500/40">
          <Upload className="h-8 w-8 text-cyan-300" />
          <div className="mt-3 text-sm font-semibold text-white">
            {isImportSubmitting ? 'Uploading roster...' : 'Choose roster file'}
          </div>
          <div className="mt-2 text-xs text-slate-500">Supported: `.csv` and Excel-exported sheets</div>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        </label>

        {lastImportMessage ? (
          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {lastImportMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Invited</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.invited}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending Signup</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.registeredPending}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Verified</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.verified}</div>
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-2 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Roster Status</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Institution-fed students</h2>
            <p className="mt-2 text-sm text-slate-400">
              Track who has only been invited, who has started signup, and who is fully verified.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        {isRosterLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            Loading institution roster...
          </div>
        ) : roster.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            No student data fed yet. Add a student manually or import an Excel-compatible roster to begin institution-managed onboarding.
          </div>
        ) : (
          <div className="space-y-3">
            {roster.slice(0, 8).map((entry) => (
              <div key={entry._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{entry.displayName}</div>
                    <div className="mt-1 text-sm text-slate-400">{entry.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full border px-3 py-1 ${rosterTone[entry.status]}`}>
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">
                        {sourceLabel[entry.source]}
                      </span>
                      {entry.gradeOrProgram ? (
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">
                          {secondaryFieldLabel}: {entry.gradeOrProgram}
                        </span>
                      ) : null}
                      {entry.rollNumber ? (
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">
                          ID: {entry.rollNumber}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-400">
                    <div>{new Date(entry.createdAt).toLocaleDateString('en-IN')}</div>
                    <div>{entry.linkedUserId ? 'Account matched' : 'Waiting for signup'}</div>
                  </div>
                </div>
                {entry.notes ? <div className="mt-3 text-sm text-slate-400">{entry.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
