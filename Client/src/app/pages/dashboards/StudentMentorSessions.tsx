import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Users,
  Video,
  MapPin,
  School,
  BookOpen,
  UserCheck,
} from "lucide-react";
import {
  studentApi,
  StudentMentorSessionItem,
  StudentInstitutionMentorshipProgramItem,
} from "../../../api/student.api";

type IconComponent = typeof Calendar;

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not scheduled";

const formatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const sessionStatusConfig: Record<
  StudentMentorSessionItem["status"],
  { label: string; color: string; icon: IconComponent }
> = {
  Scheduled: {
    label: "Scheduled",
    color: "text-blue-400",
    icon: CalendarClock,
  },
  Completed: {
    label: "Completed",
    color: "text-emerald-400",
    icon: CheckCircle2,
  },
  Cancelled: {
    label: "Cancelled",
    color: "text-red-400",
    icon: XCircle,
  },
};

const programStatusConfig: Record<
  StudentInstitutionMentorshipProgramItem["status"],
  { label: string; color: string; icon: IconComponent }
> = {
  Pending: {
    label: "Awaiting admin review",
    color: "text-amber-400",
    icon: CalendarClock,
  },
  Assigned: {
    label: "Scheduled",
    color: "text-blue-400",
    icon: CalendarClock,
  },
  Rejected: {
    label: "Declined",
    color: "text-red-400",
    icon: XCircle,
  },
};

function StatusPill({
  icon: Icon,
  label,
  color,
}: {
  icon: IconComponent;
  label: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function MetaItem({ icon: Icon, children }: { icon: IconComponent; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {children}
    </span>
  );
}

function CountCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: IconComponent;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-2xl font-bold ${color}`}>{count}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: IconComponent;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
        <h2 className="truncate text-base font-semibold text-white">{title}</h2>
      </div>
      <span className="rounded-full border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-slate-300">
        {count}
      </span>
    </div>
  );
}

function SessionRow({ session }: { session: StudentMentorSessionItem }) {
  const status = sessionStatusConfig[session.status];

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 shadow-sm shadow-black/10 transition hover:border-slate-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
            <UserCheck className="h-3.5 w-3.5" />
            1-on-1
          </span>
          <h3 className="mt-3 text-base font-semibold text-white">{session.mentor.displayName}</h3>
          <p className="mt-1 text-sm text-slate-300">{session.title}</p>
        </div>
        <StatusPill icon={status.icon} label={status.label} color={status.color} />
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-900/35 p-3 sm:grid-cols-3">
        <MetaItem icon={Calendar}>{formatDate(session.scheduledAt)}</MetaItem>
        <MetaItem icon={Clock}>{formatTime(session.scheduledAt) || "Time pending"}</MetaItem>
        <span className="text-xs font-medium text-slate-400">{session.durationMinutes} min</span>
      </div>

      {session.meetLink && session.status === "Scheduled" ? (
        <div className="mt-3">
          <a
            href={session.meetLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-purple-400 underline-offset-2 hover:underline"
          >
            Join Google Meet -&gt;
          </a>
        </div>
      ) : null}
      {session.mentorNotes ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor Notes</div>
          <p className="text-sm text-slate-300">{session.mentorNotes}</p>
        </div>
      ) : null}
      {session.studentFeedback ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Your Feedback</div>
          <p className="text-sm text-slate-300">{session.studentFeedback}</p>
        </div>
      ) : null}
    </article>
  );
}

function ProgramRow({ program }: { program: StudentInstitutionMentorshipProgramItem }) {
  const status = programStatusConfig[program.status];
  const institutionTypeLabel = program.institution.type === "college" ? "College" : "School";
  const scheduledDate = program.scheduledAt ?? program.preferredDate;
  const DeliveryIcon = program.deliveryMode === "Online" ? Video : MapPin;

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 shadow-sm shadow-black/10 transition hover:border-slate-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            <School className="h-3.5 w-3.5" />
            {institutionTypeLabel} Programme
          </span>
          <h3 className="mt-3 text-base font-semibold text-white">{program.title}</h3>
          <p className="mt-1 text-sm text-slate-300">
            Hosted by <span className="font-medium text-white">{program.institution.displayName}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{program.objective}</p>
        </div>
        <StatusPill icon={status.icon} label={status.label} color={status.color} />
      </div>

      <div className="mt-4 grid gap-2 rounded-lg border border-slate-800 bg-slate-900/35 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetaItem icon={Calendar}>
          {formatDate(scheduledDate)}
          {program.scheduledAt ? null : <span className="ml-1 text-slate-600">(preferred)</span>}
        </MetaItem>
        {program.scheduledAt ? <MetaItem icon={Clock}>{formatTime(program.scheduledAt)}</MetaItem> : null}
        <span className="text-xs font-medium text-slate-400">{program.durationMinutes} min</span>
        <MetaItem icon={Users}>{program.expectedParticipants} participants</MetaItem>
        <MetaItem icon={DeliveryIcon}>
          {program.deliveryMode} / {program.platform}
        </MetaItem>
      </div>

      {program.mentor ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-300">
          Mentor: <span className="font-medium text-white">{program.mentor.displayName}</span>
          {program.mentor.domain ? <span className="text-slate-500"> / {program.mentor.domain}</span> : null}
        </div>
      ) : program.preferredExpertise ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-xs text-slate-400">
          Awaiting mentor assignment / Expertise requested:{" "}
          <span className="text-slate-200">{program.preferredExpertise}</span>
        </div>
      ) : null}

      {program.meetingLink && program.status === "Assigned" ? (
        <div className="mt-3">
          <a
            href={program.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-indigo-300 underline-offset-2 hover:underline"
          >
            Join {program.platform} -&gt;
          </a>
        </div>
      ) : null}
      {program.venue ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5" />
          {program.venue}
        </div>
      ) : null}
    </article>
  );
}

export function StudentMentorSessions() {
  const sessionsQuery = useQuery({
    queryKey: ["student", "mentor-sessions"],
    queryFn: studentApi.getMentorSessions,
    refetchInterval: 60_000,
  });
  const programsQuery = useQuery({
    queryKey: ["student", "institution-mentorship-programs"],
    queryFn: studentApi.getInstitutionMentorshipPrograms,
    refetchInterval: 60_000,
  });

  const sessions = sessionsQuery.data ?? [];
  const programs = programsQuery.data ?? [];

  const upcomingSessions = sessions.filter((s) => s.status === "Scheduled");
  const completedSessions = sessions.filter((s) => s.status === "Completed");
  const cancelledSessions = sessions.filter((s) => s.status === "Cancelled");

  const upcomingPrograms = programs.filter(
    (p) =>
      p.status === "Assigned" &&
      (!p.scheduledAt || new Date(p.scheduledAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000),
  );
  const pendingPrograms = programs.filter((p) => p.status === "Pending");
  const rejectedPrograms = programs.filter((p) => p.status === "Rejected");
  const pastPrograms = programs.filter(
    (p) =>
      p.status === "Assigned" &&
      p.scheduledAt &&
      new Date(p.scheduledAt).getTime() < Date.now() - 24 * 60 * 60 * 1000,
  );

  const totalUpcoming = upcomingSessions.length + upcomingPrograms.length;
  const totalPending = pendingPrograms.length;
  const totalCompleted = completedSessions.length + pastPrograms.length;
  const totalCancelled = cancelledSessions.length + rejectedPrograms.length;

  const isLoading = sessionsQuery.isLoading || programsQuery.isLoading;
  const nothingToShow = sessions.length === 0 && programs.length === 0;

  return (
    <div className="space-y-8">
      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading mentorship activity...</div>
      ) : nothingToShow ? (
        <div className="py-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <h3 className="mb-2 text-lg font-semibold text-white">No mentorship activity yet</h3>
          <p className="mx-auto max-w-md text-slate-400">
            Once a mentor schedules a 1-on-1 with you, or your school or college requests a mentorship programme,
            it will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CountCard icon={CalendarClock} label="Upcoming" count={totalUpcoming} color="text-blue-400" />
            <CountCard icon={Clock} label="Pending" count={totalPending} color="text-amber-400" />
            <CountCard icon={CheckCircle2} label="Completed" count={totalCompleted} color="text-emerald-400" />
            <CountCard icon={XCircle} label="Cancelled" count={totalCancelled} color="text-red-400" />
          </div>

          {upcomingPrograms.length > 0 ? (
            <section>
              <SectionHeading
                icon={School}
                title="Upcoming institution programmes"
                count={upcomingPrograms.length}
                color="text-indigo-400"
              />
              <div className="grid gap-4">
                {upcomingPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {upcomingSessions.length > 0 ? (
            <section>
              <SectionHeading
                icon={UserCheck}
                title="Upcoming 1-on-1 sessions"
                count={upcomingSessions.length}
                color="text-purple-400"
              />
              <div className="grid gap-4">
                {upcomingSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}

          {pendingPrograms.length > 0 ? (
            <section>
              <SectionHeading
                icon={CalendarClock}
                title="Programmes awaiting admin review"
                count={pendingPrograms.length}
                color="text-amber-400"
              />
              <div className="grid gap-4">
                {pendingPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {completedSessions.length > 0 || pastPrograms.length > 0 ? (
            <section>
              <SectionHeading
                icon={CheckCircle2}
                title="Completed"
                count={totalCompleted}
                color="text-emerald-400"
              />
              <div className="grid gap-4">
                {completedSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
                {pastPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {cancelledSessions.length > 0 || rejectedPrograms.length > 0 ? (
            <section>
              <SectionHeading
                icon={XCircle}
                title="Cancelled / Declined"
                count={totalCancelled}
                color="text-red-400"
              />
              <div className="grid gap-4">
                {cancelledSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
                {rejectedPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
