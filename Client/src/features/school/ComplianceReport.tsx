import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { schoolApi } from '../../api/school.api';
import { InstitutionWorkspaceHeader } from '../institution/InstitutionWorkspaceHeader';
import {
  ComplianceActionPriority,
  ComplianceActionRecord,
  ComplianceIncidentCategory,
  ComplianceIncidentRecord,
  ComplianceIncidentSeverity,
  ComplianceReportRecord,
} from '../../types/school.types';

type ComplianceTab = 'overview' | 'incidents' | 'alerts' | 'actions' | 'reports';

const tabLabel: Record<ComplianceTab, string> = {
  overview: 'Overview',
  incidents: 'Incidents',
  alerts: 'Alerts',
  actions: 'Actions',
  reports: 'Reports',
};

const toneClass: Record<string, string> = {
  on_track: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  in_progress: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  needs_attention: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  low: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  medium: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  high: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  critical: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  open: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  in_progress_status: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  resolved: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  dismissed: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  info: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  warning: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
};

const incidentCategories: ComplianceIncidentCategory[] = [
  'attendance',
  'submission',
  'security',
  'discipline',
  'policy',
  'other',
];

const incidentSeverities: ComplianceIncidentSeverity[] = ['low', 'medium', 'high', 'critical'];
const actionPriorities: ComplianceActionPriority[] = ['low', 'medium', 'high'];

const formatLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const badgeClass = (key: string) =>
  `rounded-full border px-3 py-1 text-xs font-semibold ${toneClass[key] ?? 'text-slate-300 bg-slate-500/10 border-slate-500/30'}`;

export default function ComplianceReport() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ComplianceTab>('overview');
  const [reports, setReports] = useState<ComplianceReportRecord[]>([]);

  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentCategory, setIncidentCategory] = useState<ComplianceIncidentCategory>('policy');
  const [incidentSeverity, setIncidentSeverity] = useState<ComplianceIncidentSeverity>('medium');

  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [actionPriority, setActionPriority] = useState<ComplianceActionPriority>('medium');

  const dashboardQuery = useQuery({
    queryKey: ['school-dashboard'],
    queryFn: schoolApi.getDashboard,
  });

  const overviewQuery = useQuery({
    queryKey: ['school-compliance-overview'],
    queryFn: schoolApi.getComplianceOverview,
  });

  const incidentsQuery = useQuery({
    queryKey: ['school-compliance-incidents'],
    queryFn: () => schoolApi.getComplianceIncidents({ limit: 50 }),
  });

  const alertsQuery = useQuery({
    queryKey: ['school-compliance-alerts'],
    queryFn: () => schoolApi.getComplianceAlerts({ limit: 50 }),
  });

  const actionsQuery = useQuery({
    queryKey: ['school-compliance-actions'],
    queryFn: schoolApi.getComplianceActions,
  });

  const latestReportQuery = useQuery({
    queryKey: ['school-latest-report'],
    queryFn: schoolApi.getLatestComplianceReport,
  });

  useEffect(() => {
    if (latestReportQuery.data) {
      setReports([latestReportQuery.data]);
    }
  }, [latestReportQuery.data]);

  const refreshCompliance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['school-compliance-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['school-compliance-incidents'] }),
      queryClient.invalidateQueries({ queryKey: ['school-compliance-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['school-compliance-actions'] }),
    ]);
  };

  const createIncidentMutation = useMutation({
    mutationFn: schoolApi.createComplianceIncident,
    onSuccess: async () => {
      setIncidentTitle('');
      setIncidentDescription('');
      await refreshCompliance();
      setActiveTab('incidents');
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: ({ incidentId, status }: { incidentId: string; status: ComplianceIncidentRecord['status'] }) =>
      schoolApi.updateComplianceIncident(incidentId, { status }),
    onSuccess: refreshCompliance,
  });

  const createAlertMutation = useMutation({
    mutationFn: schoolApi.createComplianceAlert,
    onSuccess: async () => {
      setAlertTitle('');
      setAlertMessage('');
      await refreshCompliance();
      setActiveTab('alerts');
    },
  });

  const markAlertReadMutation = useMutation({
    mutationFn: schoolApi.markComplianceAlertRead,
    onSuccess: refreshCompliance,
  });

  const createActionMutation = useMutation({
    mutationFn: schoolApi.createComplianceAction,
    onSuccess: async () => {
      setActionTitle('');
      setActionDetails('');
      await refreshCompliance();
      setActiveTab('actions');
    },
  });

  const completeActionMutation = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: ComplianceActionRecord['status'] }) =>
      schoolApi.updateComplianceAction(actionId, { status }),
    onSuccess: refreshCompliance,
  });

  const generateMutation = useMutation({
    mutationFn: schoolApi.generateComplianceReport,
    onSuccess: (payload) => {
      const generatedAt = new Date().toISOString();
      setReports((current) => [
        {
          _id: `${generatedAt}-local`,
          institutionId: 'current',
          institutionType: 'school',
          generatedAt,
          pdfUrl: payload.reportUrl,
          academicYear: dashboardQuery.data?.institutionProfile?.academicYear ?? 'Current AY',
          kpis: {},
        },
        ...current,
      ]);
      window.open(payload.reportUrl, '_blank', 'noopener,noreferrer');
      queryClient.invalidateQueries({ queryKey: ['school-latest-report'] });
    },
  });

  const overview = overviewQuery.data;

  const unresolvedIncidents = useMemo(
    () => (incidentsQuery.data ?? []).filter((incident) => incident.status === 'open' || incident.status === 'in_progress'),
    [incidentsQuery.data],
  );

  return (
    <div className="space-y-6">
      <InstitutionWorkspaceHeader
        mode="school"
        eyebrow="Student Workspace"
        title="School Compliance Panel"
        description="Monitor framework progress, handle incidents, manage alerts, and close compliance actions."
        headerAction={
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Generating report...' : 'Download Full Report'}
          </Button>
        }
      />

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-5">
          {(Object.keys(tabLabel) as ComplianceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tabLabel[tab]}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-4">
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{overview?.frameworkSummary.onTrack ?? 0}</div>
              <div className="mt-2 text-sm text-slate-400">Frameworks On Track</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{overview?.incidentSummary.open ?? 0}</div>
              <div className="mt-2 text-sm text-slate-400">Open Incidents</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{overview?.alertSummary.unread ?? 0}</div>
              <div className="mt-2 text-sm text-slate-400">Unread Alerts</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-white">{overview?.actionSummary.overdue ?? 0}</div>
              <div className="mt-2 text-sm text-slate-400">Overdue Actions</div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
            <Card className="p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Policy Frameworks</div>
              <div className="space-y-3">
                {(overview?.frameworks ?? []).map((framework) => (
                  <div
                    key={framework.name}
                    className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 md:grid-cols-[2fr,160px,140px]"
                  >
                    <div>
                      <div className="font-medium text-white">{framework.name}</div>
                      <div className="text-xs text-slate-500">{framework.scoreLevel}</div>
                    </div>
                    <div className={badgeClass(framework.status)}>{framework.displayStatus}</div>
                    <div className="text-sm text-slate-400">
                      {framework.lastUpdated
                        ? new Date(framework.lastUpdated).toLocaleDateString('en-IN')
                        : 'No update yet'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Audit Trail</div>
              <div className="space-y-3">
                {(overview?.auditTrail ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                    No compliance activity recorded yet.
                  </div>
                ) : (
                  (overview?.auditTrail ?? []).map((entry) => (
                    <div key={entry._id} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-white">{entry.title}</div>
                        <div className="text-xs text-slate-500">{formatLabel(entry.type)}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{entry.detail}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('en-IN')}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === 'incidents' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr,1.4fr]">
          <Card className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Log Incident</div>
            <input
              value={incidentTitle}
              onChange={(event) => setIncidentTitle(event.target.value)}
              placeholder="Incident title"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <textarea
              value={incidentDescription}
              onChange={(event) => setIncidentDescription(event.target.value)}
              placeholder="Description"
              rows={4}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={incidentCategory}
                onChange={(event) => setIncidentCategory(event.target.value as ComplianceIncidentCategory)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                {incidentCategories.map((item) => (
                  <option key={item} value={item}>{formatLabel(item)}</option>
                ))}
              </select>
              <select
                value={incidentSeverity}
                onChange={(event) => setIncidentSeverity(event.target.value as ComplianceIncidentSeverity)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                {incidentSeverities.map((item) => (
                  <option key={item} value={item}>{formatLabel(item)}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={() =>
                createIncidentMutation.mutate({
                  title: incidentTitle,
                  description: incidentDescription || undefined,
                  category: incidentCategory,
                  severity: incidentSeverity,
                })
              }
              disabled={createIncidentMutation.isPending || incidentTitle.trim().length < 3}
            >
              {createIncidentMutation.isPending ? 'Saving...' : 'Create Incident'}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Incident Queue</div>
            <div className="space-y-3">
              {unresolvedIncidents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                  No unresolved incidents.
                </div>
              ) : (
                unresolvedIncidents.map((incident) => (
                  <div key={incident._id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{incident.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{formatLabel(incident.category)} | {new Date(incident.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="flex gap-2">
                        <div className={badgeClass(incident.severity)}>{formatLabel(incident.severity)}</div>
                        <div className={badgeClass(incident.status === 'in_progress' ? 'in_progress_status' : incident.status)}>{formatLabel(incident.status)}</div>
                      </div>
                    </div>
                    {incident.description ? <div className="mt-3 text-sm text-slate-300">{incident.description}</div> : null}
                    <div className="mt-3 flex gap-2">
                      {incident.status !== 'in_progress' ? (
                        <Button
                          variant="secondary"
                          className="py-2"
                          onClick={() => resolveIncidentMutation.mutate({ incidentId: incident._id, status: 'in_progress' })}
                          disabled={resolveIncidentMutation.isPending}
                        >
                          Mark In Progress
                        </Button>
                      ) : null}
                      {incident.status !== 'resolved' ? (
                        <Button
                          variant="secondary"
                          className="py-2"
                          onClick={() => resolveIncidentMutation.mutate({ incidentId: incident._id, status: 'resolved' })}
                          disabled={resolveIncidentMutation.isPending}
                        >
                          Resolve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'alerts' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
          <Card className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Create Alert</div>
            <input
              value={alertTitle}
              onChange={(event) => setAlertTitle(event.target.value)}
              placeholder="Alert title"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <textarea
              value={alertMessage}
              onChange={(event) => setAlertMessage(event.target.value)}
              placeholder="Alert message"
              rows={4}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <Button
              onClick={() => createAlertMutation.mutate({ title: alertTitle, message: alertMessage, level: 'warning' })}
              disabled={createAlertMutation.isPending || alertTitle.trim().length < 3 || alertMessage.trim().length < 3}
            >
              {createAlertMutation.isPending ? 'Publishing...' : 'Publish Alert'}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Alert Feed</div>
            <div className="space-y-3">
              {(alertsQuery.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                  No alerts available.
                </div>
              ) : (
                (alertsQuery.data ?? []).map((alert) => (
                  <div key={alert._id} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{alert.title}</div>
                        <div className="mt-1 text-sm text-slate-300">{alert.message}</div>
                      </div>
                      <div className="flex gap-2">
                        <div className={badgeClass(alert.level)}>{formatLabel(alert.level)}</div>
                        <div className={badgeClass(alert.isRead ? 'completed' : 'warning')}>{alert.isRead ? 'Read' : 'Unread'}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(alert.createdAt).toLocaleString('en-IN')}</div>
                    {!alert.isRead ? (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          className="py-2"
                          onClick={() => markAlertReadMutation.mutate(alert._id)}
                          disabled={markAlertReadMutation.isPending}
                        >
                          Mark as Read
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'actions' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr,1.4fr]">
          <Card className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Create Action</div>
            <input
              value={actionTitle}
              onChange={(event) => setActionTitle(event.target.value)}
              placeholder="Action title"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <textarea
              value={actionDetails}
              onChange={(event) => setActionDetails(event.target.value)}
              placeholder="Action details"
              rows={4}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            <select
              value={actionPriority}
              onChange={(event) => setActionPriority(event.target.value as ComplianceActionPriority)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            >
              {actionPriorities.map((item) => (
                <option key={item} value={item}>{formatLabel(item)}</option>
              ))}
            </select>
            <Button
              onClick={() =>
                createActionMutation.mutate({
                  title: actionTitle,
                  details: actionDetails || undefined,
                  priority: actionPriority,
                })
              }
              disabled={createActionMutation.isPending || actionTitle.trim().length < 3}
            >
              {createActionMutation.isPending ? 'Saving...' : 'Create Action'}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Action Tracker</div>
            <div className="space-y-3">
              {(actionsQuery.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                  No compliance actions defined yet.
                </div>
              ) : (
                (actionsQuery.data ?? []).map((action) => (
                  <div key={action._id} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{action.title}</div>
                        {action.details ? <div className="mt-1 text-sm text-slate-300">{action.details}</div> : null}
                      </div>
                      <div className="flex gap-2">
                        <div className={badgeClass(action.priority)}>{formatLabel(action.priority)}</div>
                        <div className={badgeClass(action.status === 'in_progress' ? 'in_progress_status' : action.status)}>{formatLabel(action.status)}</div>
                        {action.isOverdue ? <div className={badgeClass('critical')}>Overdue</div> : null}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(action.createdAt).toLocaleString('en-IN')}</div>
                    <div className="mt-3 flex gap-2">
                      {action.status !== 'in_progress' && action.status !== 'completed' ? (
                        <Button
                          variant="secondary"
                          className="py-2"
                          onClick={() => completeActionMutation.mutate({ actionId: action._id, status: 'in_progress' })}
                          disabled={completeActionMutation.isPending}
                        >
                          Start
                        </Button>
                      ) : null}
                      {action.status !== 'completed' ? (
                        <Button
                          variant="secondary"
                          className="py-2"
                          onClick={() => completeActionMutation.mutate({ actionId: action._id, status: 'completed' })}
                          disabled={completeActionMutation.isPending}
                        >
                          Complete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'reports' ? (
        <Card className="p-6">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Compliance Reports</div>
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                No report generated yet.
              </div>
            ) : (
              reports.map((report) => (
                <div key={report._id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
                  <div>
                    <div className="font-semibold text-white">{new Date(report.generatedAt).toLocaleString('en-IN')}</div>
                    <div className="text-sm text-slate-400">{report.academicYear}</div>
                  </div>
                  <Button variant="secondary" onClick={() => window.open(report.pdfUrl, '_blank', 'noopener,noreferrer')}>
                    Open PDF
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
