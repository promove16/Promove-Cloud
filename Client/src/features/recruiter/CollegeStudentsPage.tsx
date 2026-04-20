import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  Eye,
  Files,
  Mail,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { recruiterApi } from '../../api/recruiter.api';
import { Spinner } from '../../components/ui/Spinner';
import { getStudentPortfolioViewPath } from '../marketplace/navigation';
import { RECRUITER_PAGE_CONTENT_CLASS, RecruiterSectionNav } from './RecruiterSectionNav';
import type { RecruiterTalentSummary } from '../../types/recruiter.types';

const MARKETPLACE_DETAIL_NAV_ITEMS = [
  {
    label: 'Marketplace',
    path: '/dashboard/recruiter/marketplace',
    end: false,
    icon: BriefcaseBusiness,
    matchPrefixes: ['/dashboard/recruiter/colleges'],
  },
  {
    label: 'Applications',
    path: '/dashboard/recruiter/applications',
    end: true,
    icon: Files,
  },
];

const SURFACE_CLASS =
  'border border-slate-800 bg-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.35)]';
const SECONDARY_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white';
const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60';
const SCORE_BADGE_CLASS =
  'inline-flex items-center rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 ring-1 ring-inset ring-cyan-400/20';
const FALLBACK_BATCH_LABEL = 'Batch not specified';
const COLLEGE_STUDENT_PAGE_SIZE = 50;
const COLLEGE_STUDENT_MAX_PAGES = 6;

type BatchGroup = {
  label: string;
  students: RecruiterTalentSummary[];
};

const getBatchLabel = (student: RecruiterTalentSummary) =>
  student.institution?.academicYear?.trim() || FALLBACK_BATCH_LABEL;

const getBatchSortValue = (label: string) => {
  const match = label.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : -1;
};

const groupStudentsByBatch = (students: RecruiterTalentSummary[]): BatchGroup[] => {
  const grouped = new Map<string, RecruiterTalentSummary[]>();

  students.forEach((student) => {
    const batchLabel = getBatchLabel(student);
    const existing = grouped.get(batchLabel);

    if (existing) {
      existing.push(student);
      return;
    }

    grouped.set(batchLabel, [student]);
  });

  return Array.from(grouped.entries())
    .map(([label, batchStudents]) => ({
      label,
      students: [...batchStudents].sort(
        (left, right) =>
          right.innovationScore - left.innovationScore ||
          left.displayName.localeCompare(right.displayName),
      ),
    }))
    .sort(
      (left, right) =>
        getBatchSortValue(right.label) - getBatchSortValue(left.label) ||
        left.label.localeCompare(right.label),
    );
};

const loadStudentsForInstitution = async (institutionName: string) => {
  const itemMap = new Map<string, RecruiterTalentSummary>();
  let nextPage: number | null = 1;

  for (let pageCount = 0; nextPage && pageCount < COLLEGE_STUDENT_MAX_PAGES; pageCount += 1) {
    const response = await recruiterApi.discoverTalent({
      institution: institutionName,
      minScore: 0,
      maxScore: 1000,
      page: nextPage,
      limit: COLLEGE_STUDENT_PAGE_SIZE,
    });

    response.items.forEach((student) => {
      itemMap.set(student._id, student);
    });

    nextPage = response.nextPage;
  }

  return Array.from(itemMap.values()).sort(
    (left, right) =>
      right.innovationScore - left.innovationScore ||
      left.displayName.localeCompare(right.displayName),
  );
};

export default function CollegeStudentsPage() {
  const navigate = useNavigate();
  const { collegeId } = useParams<{ collegeId: string }>();
  const [searchParams] = useSearchParams();

  const collegesQuery = useQuery({
    queryKey: ['recruiter', 'colleges'],
    queryFn: recruiterApi.getColleges,
  });

  const selectedCollege = useMemo(
    () => (collegesQuery.data ?? []).find((college) => college._id === collegeId) ?? null,
    [collegeId, collegesQuery.data],
  );

  const fallbackInstitutionName = searchParams.get('institution')?.trim() ?? '';
  const institutionName = selectedCollege?.displayName ?? fallbackInstitutionName;

  const studentsQuery = useQuery({
    queryKey: ['recruiter', 'college-students-page', collegeId, institutionName],
    queryFn: () => loadStudentsForInstitution(institutionName),
    enabled: Boolean(institutionName),
  });

  const shortlistMutation = useMutation({
    mutationFn: (studentId: string) => recruiterApi.shortlistStudent(studentId),
    onSuccess: async () => {
      await studentsQuery.refetch();
    },
  });

  const students = studentsQuery.data ?? [];
  const batchGroups = useMemo(() => groupStudentsByBatch(students), [students]);
  const topScore = students[0]?.innovationScore ?? 0;
  const contactableStudents = students.filter((student) => student.canContact).length;

  return (
    <div className={`${RECRUITER_PAGE_CONTENT_CLASS} space-y-6`}>
      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl space-y-3">
            <RecruiterSectionNav items={MARKETPLACE_DETAIL_NAV_ITEMS} />
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">College Talent View</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  {(selectedCollege?.displayName ?? institutionName) || 'Institution students'}
                </h1>
                <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                  {students.length} students
                </span>
                <span className={SCORE_BADGE_CLASS}>Top score {topScore}</span>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-400">
                Recruiter-friendly student listing grouped by batch and ordered by innovation score so each cohort is
                easier to scan before opening individual portfolios.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 xl:pt-8 xl:justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard/recruiter/marketplace?role=colleges')}
              className={SECONDARY_BUTTON_CLASS}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to colleges
            </button>
            {selectedCollege ? (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/messages/${selectedCollege._id}?queryType=hiring_event`)}
                className={PRIMARY_BUTTON_CLASS}
              >
                <Mail className="h-4 w-4" />
                Plan Hiring Event
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-2xl p-4 ${SURFACE_CLASS}`}>
            <div className="flex items-center gap-3 text-slate-300">
              <Building2 className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.22em]">Institution</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              {selectedCollege?.location ?? 'Location will appear after college data loads'}
            </div>
          </div>

          <div className={`rounded-2xl p-4 ${SURFACE_CLASS}`}>
            <div className="flex items-center gap-3 text-slate-300">
              <CalendarRange className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.22em]">Batches</span>
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{batchGroups.length}</div>
          </div>

          <div className={`rounded-2xl p-4 ${SURFACE_CLASS}`}>
            <div className="flex items-center gap-3 text-slate-300">
              <Users className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.22em]">Contact Open</span>
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{contactableStudents}</div>
          </div>

          <div className={`rounded-2xl p-4 ${SURFACE_CLASS}`}>
            <div className="flex items-center gap-3 text-slate-300">
              <Trophy className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.22em]">Placement Velocity</span>
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{selectedCollege?.placementVelocity ?? 0}%</div>
          </div>
        </div>
      </section>

      {collegesQuery.isLoading && !selectedCollege && !institutionName ? (
        <section className={`rounded-2xl px-4 py-10 sm:px-6 ${SURFACE_CLASS}`}>
          <div className="flex items-center justify-center">
            <Spinner />
          </div>
        </section>
      ) : null}

      {!collegesQuery.isLoading && !institutionName ? (
        <section className={`rounded-2xl px-4 py-10 sm:px-6 ${SURFACE_CLASS}`}>
          <div className="text-sm font-medium text-white">Institution not found</div>
          <p className="mt-1 text-sm text-slate-300">
            The selected college could not be resolved. Return to the marketplace and open the student list again.
          </p>
        </section>
      ) : null}

      {institutionName ? (
        <section className={`overflow-hidden rounded-2xl ${SURFACE_CLASS}`}>
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-300 sm:px-6">
            <span>Student cohorts</span>
            <span>{students.length}</span>
          </div>

          {studentsQuery.isLoading ? (
            <div className="px-4 py-10 sm:px-6">
              <div className="flex items-center justify-center">
                <Spinner />
              </div>
            </div>
          ) : null}

          {studentsQuery.isError ? (
            <div className="px-4 py-6 text-sm text-rose-200 sm:px-6">
              Unable to load students for this institution right now.
            </div>
          ) : null}

          {!studentsQuery.isLoading && !studentsQuery.isError && students.length === 0 ? (
            <div className="px-4 py-10 sm:px-6">
              <div className="text-sm font-medium text-white">No students available</div>
              <p className="mt-1 text-sm text-slate-300">
                No recruiter-visible students were found for this institution yet.
              </p>
            </div>
          ) : null}

          {!studentsQuery.isLoading && !studentsQuery.isError && students.length > 0 ? (
            <div className="space-y-6 px-4 py-5 sm:px-6">
              {batchGroups.map((group) => (
                <section key={group.label} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Batch</div>
                      <h2 className="mt-1 text-lg font-semibold text-white">{group.label}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                        {group.students.length} students
                      </span>
                      <span className={SCORE_BADGE_CLASS}>Highest {group.students[0]?.innovationScore ?? 0}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    {group.students.map((student) => {
                      const shortlistInFlight =
                        shortlistMutation.isPending && shortlistMutation.variables === student._id;

                      return (
                        <article
                          key={student._id}
                          className="flex flex-col gap-4 px-4 py-5 transition hover:bg-slate-900 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0 space-y-3">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-base font-semibold text-white ring-1 ring-slate-700">
                                {student.avatar ? (
                                  <img
                                    src={student.avatar}
                                    alt={student.displayName}
                                    className="h-12 w-12 object-cover"
                                  />
                                ) : (
                                  student.displayName.slice(0, 1).toUpperCase()
                                )}
                              </div>

                              <div className="min-w-0 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-semibold text-white">{student.displayName}</h3>
                                  <span className={SCORE_BADGE_CLASS}>Score {student.innovationScore}</span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                      student.canContact
                                        ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/25'
                                        : 'bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-400/25'
                                    }`}
                                  >
                                    {student.canContact ? 'Contact Open' : 'Contact Gated'}
                                  </span>
                                </div>
                                <p className="text-sm text-cyan-100">
                                  {student.activeProject?.title ?? 'No active workspace shared'}{' '}
                                  {student.activeProject?.stage ? `• ${student.activeProject.stage}` : ''}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1">
                                    {student.institution?.name ?? institutionName}
                                  </span>
                                  {student.activeProject?.category ? (
                                    <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1">
                                      {student.activeProject.category}
                                    </span>
                                  ) : null}
                                  {student.skills.slice(0, 3).map((skill) => (
                                    <span
                                      key={`${student._id}-${skill}`}
                                      className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => navigate(getStudentPortfolioViewPath(student._id))}
                              className={SECONDARY_BUTTON_CLASS}
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </button>
                            {student.canContact ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/messages/${student._id}`)}
                                className={PRIMARY_BUTTON_CLASS}
                              >
                                <Mail className="h-4 w-4" />
                                Message
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => shortlistMutation.mutate(student._id)}
                                disabled={shortlistInFlight}
                                className={PRIMARY_BUTTON_CLASS}
                              >
                                <ShieldCheck className="h-4 w-4" />
                                {shortlistInFlight ? 'Shortlisting...' : 'Shortlist'}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}

              {students.length >= COLLEGE_STUDENT_PAGE_SIZE * COLLEGE_STUDENT_MAX_PAGES ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Showing the first {COLLEGE_STUDENT_PAGE_SIZE * COLLEGE_STUDENT_MAX_PAGES} recruiter-visible students
                  for this institution.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {shortlistMutation.isError ? (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Unable to shortlist that student right now.
        </section>
      ) : null}

      {students.length > 0 ? (
        <section className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Why this view</div>
              <h2 className="mt-1 text-xl font-semibold text-white">Batch-first review for recruiters</h2>
            </div>
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300">
              {contactableStudents} direct contacts ready
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Innovation score ordering
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Each batch is sorted by score so the strongest student innovators remain at the top of every cohort.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Users className="h-4 w-4 text-cyan-300" />
                Faster cohort scanning
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Batch grouping removes the context switch caused by jumping back into the general students lane.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Mail className="h-4 w-4 text-cyan-300" />
                Action-ready cards
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Recruiters can move directly from review into profile checks, messaging, and shortlist actions.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
