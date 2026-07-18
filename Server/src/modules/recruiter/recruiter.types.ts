import { RelevanceBridgeType } from './relevanceBridge.model';
import { JobApplicationSource, JobApplicationStage } from './jobPost.model';

export interface RecruiterTalentScoreBreakdown {
  problemsClaimed: number;
  problemsCompleted: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
}

export interface RecruiterInstitutionSummary {
  _id: string;
  name: string;
  location: string;
  academicYear?: string;
  iicStarRating?: number;
}

export interface RecruiterActiveProject {
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
}

export interface RecruiterTalentSummary {
  _id: string;
  displayName: string;
  avatar?: string;
  innovationScore: number;
  scoreBreakdown: RecruiterTalentScoreBreakdown;
  skills: string[];
  institution?: RecruiterInstitutionSummary;
  activeProject?: RecruiterActiveProject;
  canContact: boolean;
  bridgeType?: RelevanceBridgeType;
  contactEmail?: string;
  createdAt: string;
}

export interface RecruiterTalentTimelineItem {
  _id: string;
  trigger: string;
  delta: number;
  scoreAfter: number;
  createdAt: string;
}

export interface RecruiterTalentProject {
  _id: string;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: string;
}

export interface RecruiterTalentPatent {
  _id: string;
  projectTitle: string;
  status: string;
  problemStatement?: string;
  submittedAt: string;
}

export interface RecruiterTalentEducation {
  _id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  endYear?: number | null;
  grade: string;
}

export interface RecruiterTalentExperience {
  _id: string;
  title: string;
  company: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description: string;
  skills: string[];
}

export interface RecruiterTalentPortfolioProject {
  _id: string;
  title: string;
  description: string;
  techStack: string[];
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
}

export interface RecruiterTalentStartup {
  _id: string;
  name: string;
  category: string;
  stage: string;
  launchedAt?: string;
}

export interface RecruiterTalentProfile extends RecruiterTalentSummary {
  bio?: string;
  headline?: string;
  scoreTimeline: RecruiterTalentTimelineItem[];
  workspaces: RecruiterTalentProject[];
  patents: RecruiterTalentPatent[];
  startups: RecruiterTalentStartup[];
  education: RecruiterTalentEducation[];
  experience: RecruiterTalentExperience[];
  portfolioProjects: RecruiterTalentPortfolioProject[];
}

export interface RecruiterDashboardMatch extends RecruiterTalentSummary {
  headline: string;
}

export interface RecruiterDashboardData {
  openPositions: number;
  shortlistedThisWeek: number;
  activeDrives: number;
  newScoreMatchCandidates: number;
  newMatches: RecruiterDashboardMatch[];
}

export interface RecruiterJobView {
  _id: string;
  recruiterId: string;
  title: string;
  company: string;
  description: string;
  domain: string;
  minimumInnovationScore: number;
  type: 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
  location: string;
  workMode?: 'On-site' | 'Hybrid' | 'Remote';
  salaryExpectation?: string;
  experienceLevel?: string;
  openings?: number;
  companyOverview?: string;
  roleSummary?: string;
  keyResponsibilities: string[];
  requirements: string[];
  benefits: string[];
  applicationSteps: string[];
  isActive: boolean;
  applicantCount: number;
  shortlistedCount: number;
  hasApplied?: boolean;
  applicationStage?: JobApplicationStage;
  applicationSource?: JobApplicationSource;
  applicationUpdatedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface RecruiterJobDetail extends RecruiterJobView {
  applicantIds: string[];
  shortlistedIds: string[];
}

export interface RecruiterJobApplicantView extends RecruiterTalentSummary {
  stage: JobApplicationStage;
  source: JobApplicationSource;
  appliedAt: string;
  updatedAt: string;
  note?: string;
}

export interface RecruiterJobPipelineView {
  job: RecruiterJobDetail;
  applications: RecruiterJobApplicantView[];
}

export interface RecruiterStudentApplicationView {
  job: RecruiterJobView;
  recruiter: {
    _id: string;
    displayName: string;
    avatar?: string;
    headline?: string;
  };
  stage: JobApplicationStage;
  source: JobApplicationSource;
  appliedAt: string;
  updatedAt: string;
  note?: string;
}

export interface RecruiterDriveRegisteredStudent {
  studentId: string;
  studentName: string;
  avatar?: string;
  innovationScore: number;
  registeredAt: string;
  submissionScore?: number;
}

export interface RecruiterDriveView {
  _id: string;
  recruiterId: string;
  collegeId: string;
  collegeName: string;
  title: string;
  description: string;
  type: 'Placement Drive' | 'Internship Drive' | 'Hackathon';
  scheduledAt: string;
  minimumInnovationScore: number;
  registeredStudents: RecruiterDriveRegisteredStudent[];
  isActive: boolean;
  recruiterName?: string;
  recruiterCompany?: string;
  createdAt: string;
}

export interface RecruiterCollegeCard {
  _id: string;
  displayName: string;
  location: string;
  studentCount: number;
  placementVelocity: number;
  iicStarRating: number;
  focusLabel: string;
}

export interface RecruiterPlacementRow {
  _id: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  collegeName?: string;
  status: 'Discovered' | 'Shortlisted' | 'Hired' | 'Rejected' | 'In Progress';
  companyName?: string;
  innovationScore: number;
  updatedAt: string;
}

export interface RecruiterListResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  nextPage: number | null;
}

export interface RecruiterMessageCheck {
  canContact: boolean;
  bridgeType?: RelevanceBridgeType;
}
