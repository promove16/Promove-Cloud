import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Download,
  ShieldCheck,
  Star,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DashboardEmpty } from './dashboardSurface';
import type {
  ComplianceFrameworkItem,
  ComplianceOverviewData,
  ComplianceReportRecord,
  StudentLeaderboardItem,
} from '../../types/school.types';

export type InstitutionOverviewAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type OverviewStatCard = {
  label: string;
  value: number | string;
  helper: string;
  icon: LucideIcon;
  to?: string;
  iconClassName?: string;
  accentClassName?: string;
};

type RatingBreakdownItem = {
  label: string;
  value: number | string;
  helper?: string;
  icon: LucideIcon;
  to?: string;
  iconClassName?: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  icon: LucideIcon;
  to?: string;
  iconClassName?: string;
};

type ConnectionChip = {
  label: string;
  value: string;
};

type InstitutionOverviewDashboardProps = {
  institutionLabel: string;
  institutionName: string;
  subtitle: string;
  academicYear: string;
  headerAction?: InstitutionOverviewAction;
  statCards: OverviewStatCard[];
  connectionTitle: string;
  connectionDescription: string;
  connectionTag: string;
  connectionChips: ConnectionChip[];
  ratingValue: number;
  ratingMax?: number;
  ratingUpdatedAt?: string;
  ratingTitle?: string;
  ratingCurrentLabel?: string;
  ratingSummary: string;
  ratingBreakdown: RatingBreakdownItem[];
  ratingNote: string;
  complianceFrameworks: ComplianceFrameworkItem[];
  complianceSummary?: Pick<
    ComplianceOverviewData,
    'frameworkSummary' | 'incidentSummary' | 'alertSummary' | 'actionSummary'
  >;
  latestReport?: ComplianceReportRecord | null;
  complianceAction?: InstitutionOverviewAction;
  topInnovatorsTitle: string;
  topInnovatorsAction?: InstitutionOverviewAction;
  topInnovatorsEmptyMessage: string;
  topStudents: StudentLeaderboardItem[];
  studentTo?: (student: StudentLeaderboardItem) => string;
  activityTitle: string;
  activityAction?: InstitutionOverviewAction;
  activityItems: ActivityItem[];
  activityEmptyMessage: string;
  isLoading?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const compactNumberFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const PANEL_CLASS_NAME =
  'rounded-[20px] border border-slate-800 bg-slate-900 shadow-[0_24px_70px_rgba(2,6,23,0.28)]';

const getInitials = (value: string) =>
  value
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const formatDate = (value?: string) => {
  if (!value) {
    return 'Awaiting sync';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Awaiting sync';
  }

  return dateFormatter.format(parsed);
};

const formatRelativeTime = (value?: string) => {
  if (!value) {
    return 'No recent sync';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'No recent sync';
  }

  const diffInDays = Math.round((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (Math.abs(diffInDays) < 1) {
    return 'Updated today';
  }

  return `Updated ${relativeTimeFormatter.format(diffInDays, 'day')}`;
};

const getComplianceTone = (status: ComplianceFrameworkItem['status']) => {
  switch (status) {
    case 'on_track':
      return {
        badgeClassName: 'border-emerald-700 bg-emerald-900 text-emerald-200',
        lineClassName: 'bg-emerald-400',
      };
    case 'in_progress':
      return {
        badgeClassName: 'border-amber-700 bg-amber-900 text-amber-100',
        lineClassName: 'bg-amber-400',
      };
    default:
      return {
        badgeClassName: 'border-rose-700 bg-rose-900 text-rose-200',
        lineClassName: 'bg-rose-400',
      };
  }
};

const getRankToneClassName = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-[#ffb84d] text-[#381700]';
    case 2:
      return 'bg-[#e2f1ff] text-[#16304d]';
    case 3:
      return 'bg-[#ff8d52] text-[#361100]';
    default:
      return 'bg-[#7d6cff] text-white';
  }
};

const renderPrimaryAction = (
  action?: InstitutionOverviewAction,
  icon: ReactNode = <ArrowRight className="h-4 w-4" />,
) => {
  if (!action) {
    return null;
  }

  const buttonClassName =
    'h-10 rounded-xl border border-[#7c5cff] bg-[#6d4cff] px-4 text-sm font-semibold text-white hover:border-[#8a70ff] hover:bg-[#7a5cff]';

  if (action.to) {
    return (
      <Link to={action.to}>
        <Button className={buttonClassName} disabled={action.disabled}>
          {action.label}
          {icon}
        </Button>
      </Link>
    );
  }

  return (
    <Button onClick={action.onClick} disabled={action.disabled} className={buttonClassName}>
      {action.label}
      {icon}
    </Button>
  );
};

const renderInlineAction = (action?: InstitutionOverviewAction) => {
  if (!action) {
    return null;
  }

  const content = (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200 transition hover:text-cyan-100">
      {action.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );

  if (action.to) {
    return <Link to={action.to}>{content}</Link>;
  }

  return (
    <button type="button" onClick={action.onClick} disabled={action.disabled}>
      {content}
    </button>
  );
};

export const formatDisplayAcademicYear = (val?: string): string => {
  if (!val || typeof val !== 'string') {
    const now = new Date();
    const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === 'current ay') {
    const now = new Date();
    const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }
  return trimmed.replace(/\b20\d{3,}\b/g, (m) => `20${m.slice(-2)}`);
};

export function InstitutionOverviewDashboard({
  institutionLabel,
  institutionName,
  subtitle,
  academicYear,
  headerAction,
  statCards,
  connectionTitle,
  connectionDescription,
  connectionTag,
  connectionChips,
  ratingValue,
  ratingMax = 5,
  ratingUpdatedAt,
  ratingTitle = 'IIC Star Rating Estimator',
  ratingCurrentLabel = 'Current institutional rating',
  ratingSummary,
  ratingBreakdown,
  ratingNote,
  complianceFrameworks,
  complianceSummary,
  latestReport,
  complianceAction,
  topInnovatorsTitle,
  topInnovatorsAction,
  topInnovatorsEmptyMessage,
  topStudents,
  studentTo,
  activityTitle,
  activityAction,
  activityItems,
  activityEmptyMessage,
  isLoading = false,
}: InstitutionOverviewDashboardProps) {
  const normalizedRating = Number.isFinite(ratingValue) ? ratingValue : 0;
  const ratingPercent = Math.max(0, Math.min(100, (normalizedRating / ratingMax) * 100));
  const filledStars = Math.max(0, Math.min(5, Math.round(normalizedRating)));
  const onTrackCount = complianceSummary?.frameworkSummary.onTrack ?? 0;
  const totalFrameworks = complianceSummary?.frameworkSummary.total ?? complianceFrameworks.length;
  const pendingFrameworkCount = Math.max(totalFrameworks - onTrackCount, 0);
  const alertCount = complianceSummary?.alertSummary.unread ?? 0;
  const displayAcademicYear = formatDisplayAcademicYear(academicYear);
  const footerCopy = latestReport
    ? `Latest report generated on ${formatDate(latestReport.generatedAt)} for ${formatDisplayAcademicYear(latestReport.academicYear)}.`
    : 'Upload fresh compliance evidence to unlock the latest audit export.';

  return (
    <div className="space-y-6 text-slate-50">
      <section className="space-y-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
              <Building2 className="h-3.5 w-3.5" />
              {institutionLabel}
            </div>
            <div>
              <h1 className="text-[30px] font-semibold tracking-[-0.05em] text-white sm:text-[34px]">
                Institution Command Centre
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Real-time analytics and compliance pulse for {institutionName}. {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-start">{renderPrimaryAction(headerAction, <Download className="h-4 w-4" />)}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {statCards.map((stat) => {
            const content = (
              <div
                className={`${PANEL_CLASS_NAME} h-full rounded-[16px] px-4 py-4 transition hover:border-slate-700 hover:bg-slate-800`}
              >
                <div className={`h-1 w-12 rounded-full ${stat.accentClassName ?? 'bg-cyan-400'}`} />
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                  <stat.icon className={`h-4.5 w-4.5 ${stat.iconClassName ?? 'text-cyan-200'}`} />
                </div>
                <div className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.05em] text-white">
                  {stat.value}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-100">{stat.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{stat.helper}</div>
              </div>
            );

            return stat.to ? (
              <Link key={stat.label} to={stat.to} className="block">
                {content}
              </Link>
            ) : (
              <div key={stat.label}>{content}</div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[18px] border border-[#5c3512] bg-[linear-gradient(135deg,#321103_0%,#6b2e08_52%,#2b1307_100%)] px-5 py-4 shadow-[0_18px_60px_rgba(120,49,8,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e58b39]/35 bg-[#351809]">
              <ShieldCheck className="h-5 w-5 text-[#ffb15d]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{connectionTitle}</h2>
                <span className="rounded-full border border-emerald-700 bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  {connectionTag}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-orange-100/80">
                {connectionDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {connectionChips.map((chip) => (
                  <div
                    key={chip.label}
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] text-orange-50"
                  >
                    <span className="font-semibold text-white">{chip.value}</span> {chip.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pl-[60px] lg:pl-0">
            <div className="text-right text-[32px] font-semibold leading-none tracking-[-0.06em] text-white">
              {displayAcademicYear}
            </div>
            <div className="mt-1 text-right text-[11px] uppercase tracking-[0.24em] text-orange-100/70">
              Active year
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1.05fr)]">
        <div className={`${PANEL_CLASS_NAME} px-5 py-5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-amber-800/40 bg-amber-950/50">
                <Trophy className="h-4.5 w-4.5 text-amber-300" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Rating estimator
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">{ratingTitle}</h2>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={`h-4 w-4 ${index < filledStars ? 'fill-current text-amber-400' : 'text-slate-700'}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[16px] border border-slate-800 bg-slate-950 px-4 py-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {ratingCurrentLabel}
                </div>
                <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-white">
                  {normalizedRating.toFixed(1)}
                  <span className="text-base text-slate-500"> / {ratingMax.toFixed(1)}</span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">{formatRelativeTime(ratingUpdatedAt)}</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f6a623_0%,#f97316_100%)]"
                style={{ width: `${ratingPercent}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{ratingSummary}</p>
          </div>

          <div className="mt-4 space-y-2">
            {ratingBreakdown.map((item) => {
              const content = (
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-800 bg-slate-950 px-4 py-3 transition hover:border-slate-700">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                      <item.icon className={`h-4 w-4 ${item.iconClassName ?? 'text-cyan-200'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{item.label}</div>
                      {item.helper ? (
                        <div className="truncate text-xs text-slate-500">{item.helper}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-lg font-semibold tracking-[-0.04em] text-white">
                    {item.value}
                  </div>
                </div>
              );

              return item.to ? (
                <Link key={item.label} to={item.to} className="block">
                  {content}
                </Link>
              ) : (
                <div key={item.label}>{content}</div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[14px] border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs leading-5 text-cyan-100/80">
            {ratingNote}
          </div>
        </div>

        <div className={`${PANEL_CLASS_NAME} px-5 py-5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                <ShieldCheck className="h-4.5 w-4.5 text-cyan-200" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Compliance
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">Policy Compliance Panel</h2>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-full border border-emerald-700 bg-emerald-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                {onTrackCount} are on track
              </div>
              {renderInlineAction(complianceAction)}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {complianceFrameworks.length === 0 ? (
              <DashboardEmpty
                message={
                  isLoading
                    ? 'Loading policy compliance panel...'
                    : 'No compliance frameworks available yet.'
                }
              />
            ) : (
              complianceFrameworks.slice(0, 6).map((framework) => {
                const tone = getComplianceTone(framework.status);

                return (
                  <div
                    key={framework.name}
                    className="rounded-[16px] border border-slate-800 bg-slate-950 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{framework.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {framework.lastUpdated
                            ? `Updated ${formatDate(framework.lastUpdated)}`
                            : 'Awaiting update'}
                        </div>
                      </div>
                      <div
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${tone.badgeClassName}`}
                      >
                        {framework.displayStatus}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <div className="text-slate-500">Score / level</div>
                      <div className="font-semibold text-slate-300">{framework.scoreLevel}</div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${tone.lineClassName}`}
                        style={{ width: `${getFrameworkFill(framework.status)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 rounded-[14px] border border-[#5c3512] bg-[#2d1a07] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold uppercase tracking-[0.22em] text-[#f6b24d]">
                Compliance pulse
              </div>
              <div className="text-[#ffd28a]">{formatDate(ratingUpdatedAt)}</div>
            </div>
            <div className="mt-2 text-sm leading-6 text-orange-50/82">{footerCopy}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#ffd28a]">
              <span>{pendingFrameworkCount} pending reviews</span>
              <span>{alertCount} unread alerts</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={`${PANEL_CLASS_NAME} px-5 py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Leaderboard</div>
              <h2 className="mt-1 text-xl font-semibold text-white">{topInnovatorsTitle}</h2>
            </div>
            {renderInlineAction(topInnovatorsAction)}
          </div>

          {topStudents.length === 0 ? (
            <DashboardEmpty
              message={isLoading ? 'Loading top innovators...' : topInnovatorsEmptyMessage}
            />
          ) : (
            <div className="mt-5 space-y-2">
              {topStudents.slice(0, 5).map((student) => {
                const studentHref = studentTo ? studentTo(student) : undefined;
                const content = (
                  <div className="flex items-center gap-3 rounded-[14px] border border-slate-800 bg-slate-950 px-4 py-3 transition hover:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${getRankToneClassName(student.rank)}`}
                      >
                        {student.rank}
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-xs font-semibold text-cyan-100">
                        {student.avatar ? (
                          <img
                            src={student.avatar}
                            alt={student.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(student.displayName)
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {student.displayName}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {student.activeProject?.title ?? 'No active workspace'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold tracking-[-0.04em] text-white">
                        {compactNumberFormatter.format(student.innovationScore)}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Score
                      </div>
                    </div>
                  </div>
                );

                return studentHref ? (
                  <Link key={student._id} to={studentHref} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={student._id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`${PANEL_CLASS_NAME} px-5 py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Activity</div>
              <h2 className="mt-1 text-xl font-semibold text-white">{activityTitle}</h2>
            </div>
            {renderInlineAction(activityAction)}
          </div>

          {activityItems.length === 0 ? (
            <DashboardEmpty message={isLoading ? 'Loading recent activity...' : activityEmptyMessage} />
          ) : (
            <div className="mt-5 divide-y divide-slate-800">
              {activityItems.slice(0, 6).map((item) => {
                const content = (
                  <div className="grid gap-3 py-3 sm:grid-cols-[30px,minmax(0,1fr)]">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800">
                      <item.icon className={`h-3.5 w-3.5 ${item.iconClassName ?? 'text-cyan-200'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</div>
                      <div className="mt-2 text-xs text-slate-500">{item.meta}</div>
                    </div>
                  </div>
                );

                return item.to ? (
                  <Link key={item.id} to={item.to} className="block transition hover:bg-slate-800">
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getFrameworkFill(status: ComplianceFrameworkItem['status']) {
  switch (status) {
    case 'on_track':
      return 100;
    case 'in_progress':
      return 68;
    default:
      return 34;
  }
}
