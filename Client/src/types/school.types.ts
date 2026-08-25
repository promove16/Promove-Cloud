export type InstitutionPolicyEvidenceType =
  | 'policy_document'
  | 'activity_report'
  | 'attendance_log'
  | 'photo'
  | 'video'
  | 'meeting_minutes'
  | 'certificate'
  | 'mou'
  | 'external_audit'
  | 'other';

export interface InstitutionPolicyEvidence {
  title: string;
  type: InstitutionPolicyEvidenceType;
  url: string;
  notes?: string;
  submittedAt?: string;
}

export interface InstitutionPolicy {
  name: string;
  status: 'Active' | 'On Track' | 'Pending' | 'Inactive';
  lastUpdated?: string;
  evidence: InstitutionPolicyEvidence[];
}

export interface InstitutionPolicySubmissionRecord {
  _id: string;
  institutionId: string;
  institutionType: 'school' | 'college';
  institution?: {
    _id: string;
    displayName: string;
    email: string;
    role: 'school' | 'college';
    institutionName?: string;
    location?: string;
  };
  policies: InstitutionPolicy[];
  summaryNote?: string;
  status: 'pending' | 'approved' | 'rejected' | 'edit_requested';
  submittedAt: string;
  submittedBy: string;
  submittedByUser?: {
    _id: string;
    displayName: string;
    email: string;
  };
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByUser?: {
    _id: string;
    displayName: string;
    email: string;
  };
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionPolicySubmissionListResponse {
  items: InstitutionPolicySubmissionRecord[];
  total: number;
}

export interface ComplianceEvidenceUploadResponse {
  url: string;
  storageProvider: 's3' | 'cloudinary';
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
}

export interface InstitutionStats {
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
  totalHRConnections?: number;
  studentsPlaced?: number;
  directShortlistsThisQuarter?: number;
  topHiringSector?: string;
}

export interface InstitutionProfile {
  institutionName: string;
  location: string;
  totalStudentsEnrolled: number;
  academicYear: string;
  iicStarRating: number;
  iicLastUpdated?: string;
  organizationType?: string;
  foundedYear?: number;
  specialties: string[];
  locations: string[];
  alumniCount?: number;
  employeeCount?: number;
  contactEmail?: string;
  contactPhone?: string;
  policies: InstitutionPolicy[];
  stats: InstitutionStats;
}

export interface StudentActiveProject {
  title: string;
  stage: string;
  progressPercent: number;
}

export interface StudentLeaderboardItem {
  rank: number;
  _id: string;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  scoreBreakdown: {
    problemsClaimed: number;
    problemsCompleted: number;
    skillsCompleted: number;
    progressUploads: number;
    patentsSubmitted: number;
    patentsApproved: number;
    mvpsVerified: number;
    marketReadyVerified: number;
    startupsLaunched: number;
  };
  activeSince: string;
  stage?: string;
  activeProject?: StudentActiveProject;
}

export interface LeaderboardPage {
  items: StudentLeaderboardItem[];
  nextCursor: string | null;
}

export interface DashboardEvent {
  _id: string;
  title: string;
  type: string;
  description: string;
  scheduledAt: string;
  participantsCount: number;
}

export interface SchoolDashboardStats {
  totalStudents: number;
  activeProjects: number;
  totalInnovationActivities: number;
  patentsFiled: number;
  totalMentoringHours: number;
  startupsLaunched: number;
  industryCollaborations: number;
}

export interface InstitutionTrendSeries {
  label: string;
  color: string;
  values: number[];
}

export interface InstitutionTrendGraph {
  labels: string[];
  series: InstitutionTrendSeries[];
  rangeDays: number;
}

export interface InnovationScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface RecentProject {
  _id: string;
  studentId: string;
  studentName: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
}

export interface InstitutionPatent {
  _id: string;
  studentId: string;
  studentName: string;
  projectTitle: string;
  status: string;
  submittedAt: string;
}

export interface InstitutionStartup {
  _id: string;
  name: string;
  tagline: string;
  category: string;
  stage: string;
  founderNames: string[];
  activeProducts: number;
  teamSize: number;
  reviewStatus: string;
  launchedAt?: string;
  updatedAt: string;
}

export interface SchoolDashboardData {
  institutionProfile?: InstitutionProfile;
  stats: SchoolDashboardStats;
  recentActivityCounts: {
    scoreEventsLast30Days: number;
    patentsLast30Days: number;
    startupsLast30Days: number;
  };
  trendGraph: InstitutionTrendGraph;
  innovationScoreDistribution: InnovationScoreDistributionBucket[];
  upcomingEvents: DashboardEvent[];
  topStudents: StudentLeaderboardItem[];
  recentProjects: RecentProject[];
}

export interface StudentJourney {
  student: {
    _id: string;
    displayName: string;
    avatar?: string;
    innovationScore: number;
    scoreBreakdown: StudentLeaderboardItem['scoreBreakdown'];
  };
  scoreEvents: Array<{
    _id: string;
    trigger: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
  workspaces: Array<{
    _id: string;
    title: string;
    category: string;
    stage: string;
    progressPercent: number;
    updatedAt: string;
  }>;
  patents: Array<{
    _id: string;
    projectTitle: string;
    status: string;
    submittedAt: string;
  }>;
  startups: Array<{
    _id: string;
    name: string;
    category: string;
    stage: string;
    launchedAt?: string;
  }>;
}

export interface DirectoryInvestor {
  _id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  headline?: string;
  location?: string;
  focusAreas: string[];
  experienceCount: number;
  profileProofCount: number;
  contactPreference: string;
}

export interface StudentAccessToken {
  _id: string;
  token: string;
  label?: string;
  isActive: boolean;
  usageCount: number;
  expiresAt?: string;
  createdAt: string;
}

export interface TemporaryStudentCredential {
  _id: string;
  email: string;
  displayName: string;
  temporaryPassword: string;
  mustChangePasswordOnNextLogin: boolean;
  institutionId: string;
  institutionName?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface PendingStudentVerification {
  _id: string;
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  verificationRequestedAt?: string;
  createdAt: string;
}

export interface StudentVerificationReviewResponse {
  _id: string;
  status: 'verified' | 'rejected';
  reviewedBy: string;
  reviewedAt?: string;
  reason?: string;
}

export interface TemporaryStudentCredentials {
  student: {
    _id: string;
    displayName: string;
    email: string;
    profileSlug?: string | null;
  };
  temporaryPassword: string;
  institutionDomain: string;
  createdAt: string;
}

export interface StudentRosterEntry {
  _id: string;
  displayName: string;
  email: string;
  status: 'invited' | 'registered_pending' | 'verified' | 'rejected';
  onboardingStatus: 'listed' | 'pending_verification' | 'verified' | 'rejected';
  source: 'manual' | 'csv' | 'xlsx';
  createdAt: string;
  updatedAt: string;
  gradeOrProgram?: string;
  rollNumber?: string;
  notes?: string;
  linkedUserId?: string;
  registeredAt?: string;
  reviewedAt?: string;
}

export interface BulkCredentialImportResult {
  results: Array<{
    row: number;
    student: { _id: string; displayName: string; email: string };
    temporaryPassword: string;
  }>;
  errors: Array<{ row: number; email?: string; message: string }>;
}

export interface ManagedStudentCredentialPreviewRow {
  row: number;
  displayName: string;
  email: string;
  gradeOrProgram: string;
  rollNumber: string;
  notes: string;
  status: 'ready' | 'error';
  errors: string[];
}

export interface ManagedStudentCredentialPreview {
  fileName: string;
  rows: ManagedStudentCredentialPreviewRow[];
  summary: {
    total: number;
    ready: number;
    errors: number;
  };
}

export interface StudentRosterImportResult {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  created: number;
  updated: number;
  skipped: number;
  importedRows: number;
  entries: StudentRosterEntry[];
  createdEntries?: StudentRosterEntry[];
  updatedEntries?: StudentRosterEntry[];
  errors: Array<{
    row: number;
    email?: string;
    message: string;
  }>;
}

export interface ComplianceReportRecord {
  _id: string;
  institutionId: string;
  institutionType: 'school' | 'college';
  generatedAt: string;
  pdfUrl: string;
  academicYear: string;
  kpis: Record<string, number>;
}

export type ComplianceFrameworkStatus = 'on_track' | 'in_progress' | 'needs_attention';
export type ComplianceIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplianceIncidentStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type ComplianceIncidentCategory =
  | 'attendance'
  | 'submission'
  | 'security'
  | 'discipline'
  | 'policy'
  | 'other';
export type ComplianceIncidentSource = 'manual' | 'system';
export type ComplianceAlertLevel = 'info' | 'warning' | 'critical';
export type ComplianceActionStatus = 'pending' | 'in_progress' | 'completed';
export type ComplianceActionPriority = 'low' | 'medium' | 'high';

export interface ComplianceFrameworkItem {
  name: string;
  status: ComplianceFrameworkStatus;
  displayStatus: string;
  lastUpdated?: string;
  scoreLevel: string;
}

export interface ComplianceIncidentRecord {
  _id: string;
  title: string;
  description?: string;
  category: ComplianceIncidentCategory;
  severity: ComplianceIncidentSeverity;
  status: ComplianceIncidentStatus;
  source: ComplianceIncidentSource;
  reportedBy: string;
  assignedTo?: string;
  dueAt?: string;
  relatedStudentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceAlertRecord {
  _id: string;
  title: string;
  message: string;
  level: ComplianceAlertLevel;
  isRead: boolean;
  incidentId?: string;
  ruleKey?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceActionRecord {
  _id: string;
  incidentId?: string;
  title: string;
  details?: string;
  ownerId?: string;
  dueAt?: string;
  status: ComplianceActionStatus;
  priority: ComplianceActionPriority;
  completedAt?: string;
  completionNote?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface ComplianceAuditItem {
  _id: string;
  type: 'incident' | 'alert' | 'action';
  title: string;
  detail: string;
  createdAt: string;
}

export interface ComplianceOverviewData {
  institutionType: 'school' | 'college';
  frameworkSummary: {
    total: number;
    onTrack: number;
    inProgress: number;
    needsAttention: number;
  };
  incidentSummary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    critical: number;
  };
  alertSummary: {
    total: number;
    unread: number;
    critical: number;
  };
  actionSummary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  frameworks: ComplianceFrameworkItem[];
  latestIncidents: ComplianceIncidentRecord[];
  latestAlerts: ComplianceAlertRecord[];
  latestActions: ComplianceActionRecord[];
  auditTrail: ComplianceAuditItem[];
}
