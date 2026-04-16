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
  Briefcase,
  BookOpen,
  UserCheck,
} from "lucide-react";
import {
  studentApi,
  StudentMentorSessionItem,
  StudentInstitutionMentorshipProgramItem,
} from "../../../api/student.api";

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
  { label: string; color: string; icon: typeof CheckCircle2 }
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
  { label: string; color: string; icon: typeof CheckCircle2 }
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

function SessionRow({ session }: { session: StudentMentorSessionItem }) {
  const status = sessionStatusConfig[session.status];
  const StatusIcon = status.icon;

  return (
    <div className="border-b border-slate-800 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
          <UserCheck className="h-3 w-3" />
          1-on-1
        </span>
        <span className="text-slate-600">·</span>
        <h3 className="font-semibold text-white">{session.mentor.displayName}</h3>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-300">{session.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(session.scheduledAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(session.scheduledAt)}
        </span>
        <span className="text-slate-600">·</span>
        <span>{session.durationMinutes} min</span>
      </div>
      {session.meetLink && session.status === "Scheduled" ? (
        <div className="mt-3">
          <a
            href={session.meetLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-purple-400 underline-offset-2 hover:underline"
          >
            Join Google Meet →
          </a>
        </div>
      ) : null}
      {session.mentorNotes ? (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor Notes</div>
          <p className="text-sm text-slate-300">{session.mentorNotes}</p>
        </div>
      ) : null}
      {session.studentFeedback ? (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Your Feedback</div>
          <p className="text-sm text-slate-300">{session.studentFeedback}</p>
        </div>
      ) : null}
    </div>
  );
}

function ProgramRow({ program }: { program: StudentInstitutionMentorshipProgramItem }) {
  const status = programStatusConfig[program.status];
  const StatusIcon = status.icon;
  const institutionTypeLabel = program.institution.type === "college" ? "College" : "School";
  const scheduledDate = program.scheduledAt ?? program.preferredDate;

  return (
    <div className="border-b border-slate-800 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
          <School className="h-3 w-3" />
          {institutionTypeLabel} Programme
        </span>
        <span className="text-slate-600">·</span>
        <h3 className="font-semibold text-white">{program.title}</h3>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-300">
        Hosted by <span className="font-medium text-white">{program.institution.displayName}</span>
      </p>
      <p className="mt-1 text-sm text-slate-400">{program.objective}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(scheduledDate)}
          {program.scheduledAt ? null : <span className="ml-1 text-slate-600">(preferred)</span>}
        </span>
        {program.scheduledAt ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(program.scheduledAt)}
          </span>
        ) : null}
        <span className="text-slate-600">·</span>
        <span>{program.durationMinutes} min</span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {program.expectedParticipants} participants
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          {program.deliveryMode === "Online" ? (
            <Video className="h-3.5 w-3.5" />
          ) : (
            <MapPin className="h-3.5 w-3.5" />
          )}
          {program.deliveryMode} · {program.platform}
        </span>
      </div>

      {program.mentor ? (
        <div className="mt-3 text-sm text-slate-300">
          Mentor: <span className="font-medium text-white">{program.mentor.displayName}</span>
          {program.mentor.domain ? (
            <span className="text-slate-500"> · {program.mentor.domain}</span>
          ) : null}
        </div>
      ) : program.preferredExpertise ? (
        <div className="mt-3 text-xs text-slate-400">
          Awaiting mentor assignment · Expertise requested:{" "}
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
            Join {program.platform} →
          </a>
        </div>
      ) : null}
      {program.venue ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5" />
          {program.venue}
        </div>
      ) : null}
    </div>
  );
}

function ProgrammeOverview() {
  const tracks = [
    {
      icon: UserCheck,
      title: "1-on-1 Mentor Sessions",
      description:
        "Direct, personal sessions with your assigned mentor to review progress, unblock problems, and get tailored feedback on your startup or project.",
    },
    {
      icon: School,
      title: "School / College Mentorship Programs",
      description:
        "Institution-hosted group programmes organised by your school or college with expert mentors — covering curriculum-linked topics, cohort workshops, and guest sessions.",
    },
    {
      icon: Briefcase,
      title: "Project Mentorship",
      description:
        "An admin-assigned mentor attached to your startup workspace who watches your progress, reviews milestones, and coaches your team through launch.",
    },
  ];

  return (
    <section className="border-t border-b border-slate-800 py-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">
        The ProMove Mentorship Programme
      </h2>
      <p className="mb-5 max-w-3xl text-sm text-slate-400">
        You get mentorship from three directions: individual 1-on-1 guidance, institution-wide group programmes
        organised by your school or college, and a dedicated project mentor attached to your startup workspace.
        Each track shows up on this page so you can see everything lined up in one view.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {tracks.map((track) => {
          const Icon = track.icon;
          return (
            <div key={track.title} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div>
                <h3 className="mb-1 text-sm font-semibold text-white">{track.title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{track.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
  const pastPrograms = programs.filter(
    (p) =>
      p.status === "Assigned" &&
      p.scheduledAt &&
      new Date(p.scheduledAt).getTime() < Date.now() - 24 * 60 * 60 * 1000,
  );

  const totalUpcoming = upcomingSessions.length + upcomingPrograms.length;
  const totalCompleted = completedSessions.length + pastPrograms.length;
  const totalCancelled = cancelledSessions.length;

  const isLoading = sessionsQuery.isLoading || programsQuery.isLoading;
  const nothingToShow = sessions.length === 0 && programs.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Mentorship Hub</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Everything mentor-related in one place: your 1-on-1 sessions with assigned mentors and the school or
          college mentorship programmes your institution has organised for you.
        </p>
      </div>

      <ProgrammeOverview />

      <div className="grid gap-6 border-b border-slate-800 pb-6 sm:grid-cols-3">
        {[
          { label: "Upcoming", count: totalUpcoming, color: "text-blue-400" },
          { label: "Completed", count: totalCompleted, color: "text-emerald-400" },
          { label: "Cancelled", count: totalCancelled, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label}>
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

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
          {upcomingPrograms.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <School className="h-4 w-4 text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Upcoming institution programmes</h2>
              </div>
              <div>
                {upcomingPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {upcomingSessions.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Upcoming 1-on-1 sessions</h2>
              </div>
              <div>
                {upcomingSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}

          {pendingPrograms.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Programmes awaiting admin review</h2>
              </div>
              <div>
                {pendingPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {completedSessions.length > 0 || pastPrograms.length > 0 ? (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-white">Completed</h2>
              <div>
                {completedSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
                {pastPrograms.map((p) => (
                  <ProgramRow key={p._id} program={p} />
                ))}
              </div>
            </section>
          ) : null}

          {cancelledSessions.length > 0 ? (
            <section>
              <h2 className="mb-2 text-lg font-semibold text-white">Cancelled</h2>
              <div>
                {cancelledSessions.map((s) => (
                  <SessionRow key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
