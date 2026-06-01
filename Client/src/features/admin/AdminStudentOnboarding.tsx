import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, GraduationCap, School } from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { toast } from '../../app/components/ui/sonner';
import { ApiErrorResponse } from '../../types/auth.types';
import { BulkCredentialImportResult, TemporaryStudentCredentials } from '../../types/school.types';
import { InstitutionSearchField } from './InstitutionSearchField';
import { getInstitutionLabel } from './mentorshipAdminShared';
import { StudentIntakePanel } from '../institution/StudentIntakePanel';

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

export default function AdminStudentOnboarding() {
  const queryClient = useQueryClient();
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [bulkCredentialResult, setBulkCredentialResult] = useState<BulkCredentialImportResult | null>(null);
  const [latestTemporaryCredential, setLatestTemporaryCredential] = useState<TemporaryStudentCredentials | null>(null);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users', 'institutions'],
    queryFn: () => adminApi.getUsers({ page: 1, limit: 200 }),
  });

  const institutions = useMemo(
    () => (usersQuery.data?.items ?? []).filter((u) => u.role === 'school' || u.role === 'college'),
    [usersQuery.data],
  );

  const selectedInstitution = useMemo(
    () => institutions.find((i) => i._id === selectedInstitutionId) ?? null,
    [institutions, selectedInstitutionId],
  );

  const rosterQueryKey = ['admin-student-roster', selectedInstitutionId];
  const rosterQuery = useQuery({
    queryKey: rosterQueryKey,
    queryFn: () => adminApi.adminGetStudentRoster(selectedInstitutionId),
    enabled: Boolean(selectedInstitutionId),
  });

  const createRosterEntryMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.adminAddManualStudent>[1]) =>
      adminApi.adminAddManualStudent(selectedInstitutionId, payload),
    onSuccess: (entry) => {
      toast.success(
        entry.status === 'invited' && !entry.linkedUserId
          ? 'Student invite saved. Registration email sent.'
          : 'Student roster entry saved.',
      );
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to add this student.')),
  });

  const importRosterMutation = useMutation({
    mutationFn: (file: File) => adminApi.adminImportStudentRoster(selectedInstitutionId, file),
    onSuccess: () => {
      toast.success('Roster import complete.');
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to import roster.')),
  });

  const importWithCredentialsMutation = useMutation({
    mutationFn: (file: File) => adminApi.adminImportStudentRosterWithCredentials(selectedInstitutionId, file),
    onSuccess: (result) => {
      setBulkCredentialResult(result);
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to import roster with credentials.')),
  });

  const createTemporaryCredentialMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.adminCreateTemporaryCredentials>[1]) =>
      adminApi.adminCreateTemporaryCredentials(selectedInstitutionId, payload),
    onSuccess: (credential) => {
      setLatestTemporaryCredential(credential);
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to create temporary credentials.')),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (rosterEntryId: string) =>
      adminApi.adminCancelStudentInvite(selectedInstitutionId, rosterEntryId),
    onMutate: (id) => setCancellingInviteId(id),
    onSuccess: () => {
      toast.success('Invite cancelled.');
      void queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Unable to cancel this invite.')),
    onSettled: () => setCancellingInviteId(null),
  });

  const isSchool = selectedInstitution?.role === 'school';
  const secondaryFieldLabel = isSchool ? 'Grade / Class' : 'Program / Course';
  const secondaryFieldPlaceholder = isSchool ? 'e.g. Class 10, Grade 12' : 'e.g. B.Tech CSE, MBA';
  const institutionDomainHint = selectedInstitution?.email?.split('@')[1];
  const roster = rosterQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-400">Admin</div>
        <h1 className="mt-1.5 text-2xl font-bold text-white">Student Onboarding</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Select a school or college, then import or add students to their roster directly from the admin panel.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Select Institution</span>
        </div>
        <InstitutionSearchField
          institutions={institutions}
          value={selectedInstitutionId}
          onChange={(id) => {
            setSelectedInstitutionId(id);
            setBulkCredentialResult(null);
            setLatestTemporaryCredential(null);
          }}
          placeholder="Search school or college by name, location, or email"
          helperText="Only schools and colleges are listed. Type to search."
        />
      </div>

      {selectedInstitution ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            {isSchool ? (
              <School className="h-4 w-4 shrink-0 text-cyan-400" />
            ) : (
              <GraduationCap className="h-4 w-4 shrink-0 text-cyan-400" />
            )}
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-white">{getInstitutionLabel(selectedInstitution)}</span>
              <span className="ml-2 text-slate-500">·</span>
              <span className="ml-2 capitalize text-slate-400">{selectedInstitution.role}</span>
              {selectedInstitution.institutionProfile?.location ? (
                <>
                  <span className="ml-2 text-slate-600">·</span>
                  <span className="ml-2 text-slate-500">{selectedInstitution.institutionProfile.location}</span>
                </>
              ) : null}
            </div>
          </div>

          <StudentIntakePanel
            heading={getInstitutionLabel(selectedInstitution)}
            description={`Add students to ${getInstitutionLabel(selectedInstitution)}'s roster. An invite email will be sent automatically.`}
            secondaryFieldLabel={secondaryFieldLabel}
            secondaryFieldPlaceholder={secondaryFieldPlaceholder}
            roster={roster}
            institutionDomainHint={institutionDomainHint}
            isRosterLoading={rosterQuery.isLoading}
            isManualSubmitting={createRosterEntryMutation.isPending}
            isImportSubmitting={importRosterMutation.isPending}
            isImportWithCredentialsSubmitting={importWithCredentialsMutation.isPending}
            isTemporaryCredentialSubmitting={createTemporaryCredentialMutation.isPending}
            temporaryCredential={latestTemporaryCredential}
            bulkCredentialResult={bulkCredentialResult}
            onCreateManualEntry={createRosterEntryMutation.mutateAsync}
            onImportFile={importRosterMutation.mutate}
            onImportFileWithCredentials={importWithCredentialsMutation.mutate}
            onCreateTemporaryCredentials={createTemporaryCredentialMutation.mutate}
            onCancelInvite={cancelInviteMutation.mutate}
            cancellingInviteId={cancellingInviteId}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center text-sm text-slate-500">
          Select a school or college above to manage their student roster.
        </div>
      )}
    </div>
  );
}
