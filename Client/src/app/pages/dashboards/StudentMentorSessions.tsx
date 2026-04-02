import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { studentApi, StudentMentorSessionItem } from "../../../api/student.api";
import { StudentWorkspaceTabs } from "../../../features/student/StudentWorkspaceTabs";

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

const statusConfig: Record<
  StudentMentorSessionItem["status"],
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  Scheduled: {
    label: "Scheduled",
    color: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
    icon: CalendarClock,
  },
  Completed: {
    label: "Completed",
    color: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
    icon: CheckCircle2,
  },
  Cancelled: {
    label: "Cancelled",
    color: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
    icon: XCircle,
  },
};

function SessionCard({ session }: { session: StudentMentorSessionItem }) {
  const status = statusConfig[session.status];
  const StatusIcon = status.icon;
  const initials = session.mentor.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:border-purple-500/30">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-base font-bold text-white shadow-lg shadow-purple-500/20">
          {session.mentor.avatar ? (
            <img
              src={session.mentor.avatar}
              alt={session.mentor.displayName}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-white">{session.mentor.displayName}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-300">{session.title}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-400 transition hover:bg-purple-500/20"
              >
                Join Google Meet
              </a>
            </div>
          ) : null}
          {session.mentorNotes ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor Notes</div>
              <p className="text-sm text-slate-300">{session.mentorNotes}</p>
            </div>
          ) : null}
          {session.studentFeedback ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Your Feedback</div>
              <p className="text-sm text-slate-300">{session.studentFeedback}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StudentMentorSessions() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "mentor-sessions"],
    queryFn: studentApi.getMentorSessions,
    refetchInterval: 60_000,
  });

  const sessions = data ?? [];

  const upcoming = sessions.filter((s) => s.status === "Scheduled");
  const completed = sessions.filter((s) => s.status === "Completed");
  const cancelled = sessions.filter((s) => s.status === "Cancelled");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Mentor Sessions</h1>
        <p className="mt-2 text-slate-400">
          Track all your scheduled, completed, and cancelled sessions with mentors.
        </p>
      </div>

      <StudentWorkspaceTabs />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Upcoming", count: upcoming.length, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Completed", count: completed.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Cancelled", count: cancelled.length, color: "text-red-400", bg: "bg-red-500/10" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center text-slate-400">
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
          <CalendarClock className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <h3 className="mb-2 text-lg font-semibold text-white">No sessions yet</h3>
          <p className="text-slate-400">
            Once a mentor schedules a session with you, it will appear here.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Upcoming</h2>
              <div className="space-y-4">
                {upcoming.map((s) => (
                  <SessionCard key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Completed</h2>
              <div className="space-y-4">
                {completed.map((s) => (
                  <SessionCard key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Cancelled</h2>
              <div className="space-y-4">
                {cancelled.map((s) => (
                  <SessionCard key={s._id} session={s} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
