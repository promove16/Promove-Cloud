import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recruiterApi } from "../../api/recruiter.api";
import { getStudentPortfolioViewPath } from "../marketplace/navigation";
import type {
  RecruiterCollegeCard,
  RecruiterDriveView,
  RecruiterJobDetail,
  RecruiterPlacementRow,
  RecruiterTalentProfile,
  RecruiterTalentSummary,
} from "../../types/recruiter.types";
import {
  Briefcase, Users, Search, Filter, MapPin, Award,
  Calendar, Star, TrendingUp, Send, Eye, Plus,
  Building2, GraduationCap, Target, ArrowRight,
  CheckCircle, Clock, AlertCircle, X, ChevronRight,
  Lightbulb, FileText, Mail, MessageSquare, BadgeCheck,
  Trophy, Bell, Flame, User, ExternalLink, Download
} from "lucide-react";

type ViewType = "home" | "talent-search" | "college-connect" | "active-drives" | "onboarding";
type SearchMode = "person" | "problem";

const recruiterViewPaths: Record<ViewType, string> = {
  home: "/dashboard/recruiter",
  "talent-search": "/dashboard/recruiter/talent",
  "college-connect": "/dashboard/recruiter/colleges",
  "active-drives": "/dashboard/recruiter/drives",
  onboarding: "/dashboard/recruiter/onboarding",
};

interface RecruiterDashboardExperienceProps {
  initialView?: ViewType;
}

interface Project {
  id: number;
  title: string;
  problemStatement: string;
  domain: string;
  role: string;
  outcome: string;
  techStack: string[];
  mentor?: string;
  patentStatus: "Filed" | "Granted" | "None";
  timeline: string;
}

interface Internship {
  id: number;
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface Achievement {
  id: number;
  type: "patent" | "competition" | "badge";
  title: string;
  description: string;
  date: string;
}

interface MentorRecommendation {
  id: number;
  mentorName: string;
  mentorTitle: string;
  recommendation: string;
  date: string;
}

interface Student {
  id: string;
  name: string;
  photo: string;
  college: string;
  course: string;
  graduationYear: number;
  innovationScore: number;
  skills: string[];
  latestProject: string;
  domain: string;
  availability: "Internship" | "Full-time" | "Not listed";
  patentStatus: "Filed" | "Granted" | "None";
  cgpa: string;
  about?: string;
  projects?: Project[];
  internships?: Internship[];
  achievements?: Achievement[];
  mentorRecommendations?: MentorRecommendation[];
  canContact: boolean;
  bridgeType?: RecruiterTalentSummary["bridgeType"];
}

interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  naacGrade: string;
  iicStars: number;
  nirfRank: number | null;
  activeStudents: number;
  placementVelocity: number;
  topDomains: string[];
}

interface Drive {
  id: string;
  name: string;
  college: string;
  applications: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  status: "Active" | "Paused" | "Closed";
}

interface OnboardingCandidate {
  id: string;
  studentId: string;
  name: string;
  college: string;
  role: string;
  stage: "Offer Sent" | "Offer Accepted" | "Documents Submitted" | "Joining Confirmed" | "Day 1" | "30-Day Check-in";
  daysInStage: number;
}

interface DriveApplicant {
  id: string;
  name: string;
  college: string;
  innovationScore: number;
  stage: "Applied" | "Shortlisted" | "Interviewed" | "Offered" | "Joined";
  daysInStage: number;
}

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ST";

const currentYear = new Date().getFullYear();

const daysSince = (value?: string) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
};

const relativeTime = (value?: string) => {
  const days = daysSince(value);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Present";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Present";
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const scoreToCgpa = (score?: number) => {
  if (typeof score !== "number") return "Not added";
  return `${Math.min(10, Math.max(0, score / 20)).toFixed(1)}`;
};

const patentStatusFrom = (profile?: Pick<RecruiterTalentProfile, "patents">) => {
  if (!profile?.patents?.length) return "None" as const;
  return profile.patents.some((patent) => patent.status === "approved") ? "Granted" as const : "Filed" as const;
};

const patentStatusFromSummary = (student: RecruiterTalentSummary) => {
  if (student.scoreBreakdown.patentsApproved > 0) return "Granted" as const;
  if (student.scoreBreakdown.patentsSubmitted > 0) return "Filed" as const;
  return "None" as const;
};

const educationSummary = (profile?: RecruiterTalentProfile) => {
  const education = profile?.education?.[0];
  if (!education) return "Profile not completed";
  return [education.degree, education.fieldOfStudy].filter(Boolean).join(" ") || "Education not specified";
};

const graduationYearFor = (profile?: RecruiterTalentProfile) =>
  profile?.education?.find((item) => item.endYear)?.endYear ?? currentYear;

const latestProjectFor = (student: RecruiterTalentSummary) =>
  student.activeProject?.title ?? "No active project yet";

const domainFor = (student: RecruiterTalentSummary) =>
  student.activeProject?.category ?? student.skills[0] ?? "General Innovation";

const mapTalentToStudent = (student: RecruiterTalentSummary): Student => ({
  id: student._id,
  name: student.displayName,
  photo: initialsFor(student.displayName),
  college: student.institution?.name ?? "Independent",
  course: student.activeProject?.category ?? student.skills[0] ?? "Profile not completed",
  graduationYear: currentYear,
  innovationScore: student.innovationScore,
  skills: student.skills.length ? student.skills : ["Innovation"],
  latestProject: latestProjectFor(student),
  domain: domainFor(student),
  availability: "Not listed",
  patentStatus: patentStatusFromSummary(student),
  cgpa: scoreToCgpa(student.innovationScore),
  about: student.activeProject
    ? `${student.activeProject.title} is currently in ${student.activeProject.stage}.`
    : undefined,
  canContact: student.canContact,
  ...(student.bridgeType ? { bridgeType: student.bridgeType } : {}),
  projects: student.activeProject
    ? [
        {
          id: 1,
          title: student.activeProject.title,
          problemStatement: "Problem statement not added yet.",
          domain: student.activeProject.category,
          role: "Project contributor",
          outcome: `${student.activeProject.progressPercent}% complete in ${student.activeProject.stage}.`,
          techStack: student.skills,
          patentStatus: "None",
          timeline: "Active workspace",
        },
      ]
    : [],
});

const mapProfileToStudent = (profile: RecruiterTalentProfile): Student => {
  const portfolioProjects: Project[] = profile.portfolioProjects.map((project, index) => ({
    id: index + 1,
    title: project.title,
    problemStatement: project.description || "Problem statement not added yet.",
    domain: profile.activeProject?.category ?? profile.skills[0] ?? "General Innovation",
    role: "Portfolio project owner",
    outcome: project.isCurrent ? "Currently active." : "Completed portfolio project.",
    techStack: project.techStack.length ? project.techStack : profile.skills,
    patentStatus: patentStatusFrom(profile),
    timeline: `${formatDate(project.startDate)} - ${formatDate(project.endDate)}`,
  }));

  const workspaceProjects: Project[] = profile.workspaces.map((workspace, index) => ({
    id: portfolioProjects.length + index + 1,
    title: workspace.title,
    problemStatement:
      profile.patents.find((patent) => patent.projectTitle === workspace.title)?.problemStatement ??
      "Problem statement not added yet.",
    domain: workspace.category,
    role: "Workspace owner",
    outcome: `${workspace.progressPercent}% complete in ${workspace.stage}.`,
    techStack: profile.skills,
    patentStatus: patentStatusFrom(profile),
    timeline: `Updated ${relativeTime(workspace.updatedAt)}`,
  }));

  const internships: Internship[] = profile.experience
    .filter((experience) => experience.type === "internship")
    .map((experience, index) => ({
      id: index + 1,
      company: experience.company,
      role: experience.title,
      duration: `${formatDate(experience.startDate)} - ${experience.isCurrent ? "Present" : formatDate(experience.endDate)}`,
      description: experience.description || "No description added.",
    }));

  const patentAchievements: Achievement[] = profile.patents.map((patent, index) => ({
    id: index + 1,
    type: "patent",
    title: `${patent.status === "approved" ? "Patent Approved" : "Patent Filed"} - ${patent.projectTitle}`,
    description: patent.problemStatement ?? "Patent details not added.",
    date: formatDate(patent.submittedAt),
  }));

  return {
    id: profile._id,
    name: profile.displayName,
    photo: initialsFor(profile.displayName),
    college: profile.institution?.name ?? profile.education[0]?.institution ?? "Independent",
    course: educationSummary(profile),
    graduationYear: graduationYearFor(profile),
    innovationScore: profile.innovationScore,
    skills: profile.skills.length ? profile.skills : ["Innovation"],
    latestProject: profile.activeProject?.title ?? profile.portfolioProjects[0]?.title ?? "No active project yet",
    domain: profile.activeProject?.category ?? profile.skills[0] ?? "General Innovation",
    availability: "Not listed",
    patentStatus: patentStatusFrom(profile),
    cgpa: profile.education[0]?.grade || scoreToCgpa(profile.innovationScore),
    about: profile.bio || profile.headline || undefined,
    projects: [...portfolioProjects, ...workspaceProjects],
    internships,
    achievements: patentAchievements,
    mentorRecommendations: [],
    canContact: profile.canContact,
    ...(profile.bridgeType ? { bridgeType: profile.bridgeType } : {}),
  };
};

const mapCollege = (college: RecruiterCollegeCard): College => {
  const [city = college.location, state = ""] = college.location.split(",").map((part) => part.trim());
  return {
    id: college._id,
    name: college.displayName,
    city,
    state,
    naacGrade: "Not set",
    iicStars: Math.round(college.iicStarRating),
    nirfRank: null,
    activeStudents: college.studentCount,
    placementVelocity: college.placementVelocity,
    topDomains: college.focusLabel.split(/\s*[-|]\s*/).map((item) => item.trim()).filter(Boolean),
  };
};

const mapDrive = (drive: RecruiterDriveView): Drive => ({
  id: drive._id,
  name: drive.title,
  college: drive.collegeName,
  applications: drive.registeredStudents.length,
  shortlisted: 0,
  interviewed: drive.registeredStudents.filter((student) => typeof student.submissionScore === "number").length,
  offered: 0,
  status: drive.isActive ? "Active" : "Closed",
});

const mapDriveApplicants = (drive?: RecruiterDriveView): DriveApplicant[] =>
  drive?.registeredStudents.map((student) => ({
    id: student.studentId,
    name: student.studentName,
    college: drive.collegeName,
    innovationScore: student.innovationScore,
    stage: typeof student.submissionScore === "number" ? "Interviewed" : "Applied",
    daysInStage: daysSince(student.registeredAt),
  })) ?? [];

const onboardingStageFor = (status: RecruiterPlacementRow["status"]): OnboardingCandidate["stage"] => {
  switch (status) {
    case "Hired":
      return "Joining Confirmed";
    case "In Progress":
      return "Documents Submitted";
    case "Shortlisted":
      return "Offer Sent";
    case "Rejected":
      return "30-Day Check-in";
    case "Discovered":
    default:
      return "Offer Sent";
  }
};

const mapOnboarding = (record: RecruiterPlacementRow): OnboardingCandidate => ({
  id: record._id,
  studentId: record.studentId,
  name: record.studentName,
  college: record.collegeName ?? "College not linked",
  role: record.companyName ?? "Role not assigned",
  stage: onboardingStageFor(record.status),
  daysInStage: daysSince(record.updatedAt),
});

const initialJobForm = {
  title: "",
  company: "",
  description: "",
  domain: "",
  type: "Full-time" as "Full-time" | "Internship" | "Contract" | "Part-time",
  location: "",
  workMode: "On-site" as "On-site" | "Hybrid" | "Remote",
  minimumInnovationScore: "0",
  openings: "1",
};

export function RecruiterDashboardExperience({ initialView = "home" }: RecruiterDashboardExperienceProps) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [searchMode, setSearchMode] = useState<SearchMode>("person");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [jobFormError, setJobFormError] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [collegeSearch, setCollegeSearch] = useState("");
  const [problemQuery, setProblemQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null);
  const [profileActionMessage, setProfileActionMessage] = useState<string | null>(null);
  const [reminderSentFor, setReminderSentFor] = useState<string | null>(null);
  const [partnershipSentFor, setPartnershipSentFor] = useState<string | null>(null);

  useEffect(() => {
    setProfileActionMessage(null);
  }, [selectedStudent]);

  const goToView = (view: ViewType) => {
    setCurrentView(view);
    navigate(recruiterViewPaths[view]);
  };

  const queryClient = useQueryClient();
  const [domainFilter, setDomainFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [graduationYearFilter, setGraduationYearFilter] = useState("");
  const [minimumScore, setMinimumScore] = useState(70);
  const [patentFilters, setPatentFilters] = useState<Array<Student["patentStatus"]>>([]);
  const [availabilityFilters, setAvailabilityFilters] = useState<Array<Student["availability"]>>([
    "Internship",
    "Full-time",
    "Not listed",
  ]);
  const [driveFormError, setDriveFormError] = useState("");
  const [driveBranches, setDriveBranches] = useState<string[]>([]);
  const [driveGraduationYear, setDriveGraduationYear] = useState("2026");
  const [driveOpenings, setDriveOpenings] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["recruiter", "dashboard"],
    queryFn: recruiterApi.getDashboard,
  });

  const jobsQuery = useQuery({
    queryKey: ["recruiter", "jobs"],
    queryFn: recruiterApi.getJobs,
  });

  const talentQuery = useQuery({
    queryKey: [
      "recruiter",
      "talent",
      "discover",
      domainFilter,
      collegeFilter,
      minimumScore,
    ],
    queryFn: () =>
      recruiterApi.discoverTalent({
        domain: domainFilter || undefined,
        institution: collegeFilter || undefined,
        minScore: minimumScore,
        page: 1,
        limit: 24,
      }),
  });

  const problemSearchQuery = useQuery({
    queryKey: ["recruiter", "talent", "problem", problemQuery],
    queryFn: () =>
      recruiterApi.discoverTalent({
        search: problemQuery || undefined,
        page: 1,
        limit: 12,
      }),
    enabled: hasSearched,
  });

  const pipelineQuery = useQuery({
    queryKey: ["recruiter", "talent", "pipeline"],
    queryFn: () => recruiterApi.getTalentPipeline({ page: 1, limit: 12 }),
  });

  const collegesQuery = useQuery({
    queryKey: ["recruiter", "colleges"],
    queryFn: recruiterApi.getColleges,
  });

  const drivesQuery = useQuery({
    queryKey: ["recruiter", "drives"],
    queryFn: recruiterApi.getDrives,
  });

  const onboardingQuery = useQuery({
    queryKey: ["recruiter", "onboarding"],
    queryFn: recruiterApi.getOnboarding,
  });

  const selectedProfileQuery = useQuery({
    queryKey: ["recruiter", "student-profile", selectedStudent],
    queryFn: () => recruiterApi.getTalentProfile(selectedStudent!),
    enabled: Boolean(selectedStudent),
  });

  const createDriveMutation = useMutation({
    mutationFn: recruiterApi.createDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "drives"] });
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] });
      setShowDriveModal(false);
      setDriveFormError("");
      setDriveBranches([]);
      setDriveOpenings("");
      goToView("active-drives");
    },
    onError: (error) => {
      setDriveFormError(error instanceof Error ? error.message : "Could not create campus drive.");
    },
  });

  const createJobMutation = useMutation({
    mutationFn: recruiterApi.createJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] });
      setShowJobModal(false);
      setJobForm(initialJobForm);
      setJobFormError("");
    },
    onError: (error) => {
      setJobFormError(error instanceof Error ? error.message : "Could not create job posting.");
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: (studentId: string) => recruiterApi.shortlistStudent(studentId),
    onMutate: () => {
      setProfileActionMessage(null);
    },
    onSuccess: async (_data, studentId) => {
      queryClient.setQueryData<RecruiterTalentProfile>(
        ["recruiter", "student-profile", studentId],
        (current) =>
          current
            ? {
                ...current,
                canContact: true,
                bridgeType: "HR_SHORTLIST",
              }
            : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recruiter", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "talent"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "onboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["recruiter", "student-profile", studentId] }),
      ]);
      setProfileActionMessage("Student added to your shortlist.");
    },
    onError: (error) => {
      setProfileActionMessage(error instanceof Error ? error.message : "Could not shortlist this student.");
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (studentId: string) => recruiterApi.sendOnboardingReminder(studentId),
    onSuccess: (_data, studentId) => {
      setReminderSentFor(studentId);
    },
  });

  const [partnershipError, setPartnershipError] = useState<string | null>(null);

  const partnershipMutation = useMutation({
    mutationFn: (collegeId: string) => recruiterApi.requestPartnership(collegeId),
    onMutate: () => {
      setPartnershipError(null);
    },
    onSuccess: (_data, collegeId) => {
      setPartnershipSentFor(collegeId);
    },
    onError: (error) => {
      setPartnershipError(
        error instanceof Error ? error.message : "Could not send partnership request.",
      );
    },
  });

  const handleApplyFilters = () => {
    queryClient.invalidateQueries({ queryKey: ["recruiter", "talent", "discover"] });
  };

  const handleExportPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const submitJob = () => {
    if (
      !jobForm.title.trim() ||
      !jobForm.company.trim() ||
      !jobForm.description.trim() ||
      !jobForm.domain.trim() ||
      !jobForm.location.trim()
    ) {
      setJobFormError("Title, company, domain, location and description are required.");
      return;
    }
    createJobMutation.mutate({
      title: jobForm.title.trim(),
      company: jobForm.company.trim(),
      description: jobForm.description.trim(),
      domain: jobForm.domain.trim(),
      type: jobForm.type,
      location: jobForm.location.trim(),
      workMode: jobForm.workMode,
      minimumInnovationScore: Number(jobForm.minimumInnovationScore) || 0,
      openings: jobForm.openings ? Number(jobForm.openings) : undefined,
    });
  };

  const baseTalent = talentQuery.data?.items ?? dashboardQuery.data?.newMatches ?? [];
  const problemTalent = problemSearchQuery.data?.items ?? [];
  const profileStudent = selectedProfileQuery.data ? mapProfileToStudent(selectedProfileQuery.data) : null;

  const newMatches: Student[] = useMemo(() => {
    const mapped = baseTalent.map(mapTalentToStudent);
    return mapped.filter((student) => {
      const matchesGraduationYear = graduationYearFilter
        ? String(student.graduationYear) === graduationYearFilter
        : true;
      const matchesPatent = patentFilters.length ? patentFilters.includes(student.patentStatus) : true;
      const matchesAvailability = availabilityFilters.length
        ? availabilityFilters.includes(student.availability)
        : true;
      return matchesGraduationYear && matchesPatent && matchesAvailability;
    });
  }, [availabilityFilters, baseTalent, graduationYearFilter, patentFilters]);

  const problemMatches: Student[] = useMemo(
    () => problemTalent.map(mapTalentToStudent),
    [problemTalent],
  );

  const colleges: College[] = useMemo(
    () => (collegesQuery.data ?? []).map(mapCollege),
    [collegesQuery.data],
  );

  const sourceDrives = drivesQuery.data ?? [];
  const activeDrives: Drive[] = useMemo(
    () => sourceDrives.map(mapDrive),
    [sourceDrives],
  );

  const selectedDriveRecord = sourceDrives.find((drive) => drive._id === selectedDrive);
  const selectedDriveView = selectedDriveRecord ? mapDrive(selectedDriveRecord) : null;
  const driveApplicants = useMemo(
    () => mapDriveApplicants(selectedDriveRecord),
    [selectedDriveRecord],
  );

  const handleExportDriveReport = () => {
    if (!selectedDriveRecord) return;
    const payload = {
      drive: selectedDriveRecord,
      applicants: driveApplicants,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drive-${selectedDriveRecord._id}-report.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEditDrive = () => {
    if (!selectedDriveRecord) return;
    setSelectedCollege(selectedDriveRecord.collegeId);
    setShowDriveModal(true);
  };

  const onboardingPipeline: OnboardingCandidate[] = useMemo(
    () => (onboardingQuery.data ?? []).map(mapOnboarding),
    [onboardingQuery.data],
  );

  const recentActivity = useMemo(
    () =>
      (pipelineQuery.data?.items ?? []).map((student) => ({
        student: student.displayName,
        action: student.activeProject
          ? `updated ${student.activeProject.title}`
          : "entered your recruiter pipeline",
        time: relativeTime(student.createdAt),
      })),
    [pipelineQuery.data?.items],
  );

  const stats = {
    openPositions: dashboardQuery.data?.openPositions ?? 0,
    totalApplicants:
      (jobsQuery.data ?? []).reduce((sum, job) => sum + job.applicantCount, 0) +
      sourceDrives.reduce((sum, drive) => sum + drive.registeredStudents.length, 0),
    shortlistedThisWeek: dashboardQuery.data?.shortlistedThisWeek ?? 0,
    newScoreMatchCandidates: dashboardQuery.data?.newScoreMatchCandidates ?? 0,
  };

  const domainOptions = useMemo(
    () => Array.from(new Set(baseTalent.map(domainFor))).filter(Boolean),
    [baseTalent],
  );

  const graduationYearOptions = useMemo(
    () => Array.from(new Set(baseTalent.map((student) => mapTalentToStudent(student).graduationYear))).sort(),
    [baseTalent],
  );
  const examplePrompts = useMemo(
    () =>
      Array.from(
        new Set(
          baseTalent
            .map((student) => student.activeProject?.title ?? student.activeProject?.category ?? student.skills[0])
            .filter((prompt): prompt is string => Boolean(prompt)),
        ),
      ).slice(0, 4),
    [baseTalent],
  );

  const renderHome = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/dashboard/recruiter/applications')}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          <Users className="w-5 h-5" />
          Applications
        </button>
        <button
          onClick={() => setShowJobModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Post a Job
        </button>
        <button
          onClick={() => goToView("talent-search")}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          <Search className="w-5 h-5" />
          Search Talent
        </button>
        <button
          onClick={() => goToView("college-connect")}
          className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-pink-500/20"
        >
          <Building2 className="w-5 h-5" />
          Start a Campus Drive
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-1">Total Applicants</div>
              <div className="text-xl font-bold text-white">{stats.totalApplicants}</div>
            </div>
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.openPositions}</div>
          <div className="text-sm font-semibold text-white">Open Positions</div>
          <div className="mt-3 text-xs text-slate-400">Across all active drives</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle className="w-7 h-7 text-white" />
          </div>
          <div className="text-4xl font-bold text-white mb-2">{stats.shortlistedThisWeek}</div>
          <div className="text-sm font-semibold text-white mb-1">Shortlisted This Week</div>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span>{stats.newScoreMatchCandidates} new score matches</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div className="text-4xl font-bold text-white mb-2">{activeDrives.filter((drive) => drive.status === "Active").length}</div>
          <div className="text-sm font-semibold text-white mb-1">Active Campus Drives</div>
          <div className="text-xs text-slate-400">Across {new Set(activeDrives.map(d => d.college)).size} institutions</div>
        </div>
      </div>

      {/* New Matches Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-500" />
            New Matches
            <span className="ml-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">
              {newMatches.length}
            </span>
          </h2>
          <span className="text-sm text-slate-400">Based on your saved criteria</span>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {newMatches.map((student) => (
            <div key={student.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold text-lg">{student.photo}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">{student.name}</h3>
                  <p className="text-sm text-slate-400 truncate">{student.college}</p>
                </div>
                <div className="px-3 py-1 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-sm font-bold text-white text-center">{student.innovationScore}</div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">Latest Project</div>
                <div className="text-sm font-semibold text-white truncate">{student.latestProject}</div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {student.skills.slice(0, 3).map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                    {skill}
                  </span>
                ))}
              </div>
              <button
                onClick={() => navigate(getStudentPortfolioViewPath(student.id))}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Portfolio
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Bell className="w-6 h-6 text-purple-500" />
          Recent Activity
        </h2>
        <div className="space-y-4">
          {recentActivity.map((activity, i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 -mx-2 px-2 py-2 rounded-lg transition-all">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-white">
                  <span className="font-semibold">{activity.student}</span>{" "}
                  <span className="text-slate-400">{activity.action}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTalentSearch = () => (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex gap-2 max-w-md">
        <button
          onClick={() => {
            setSearchMode("person");
            setHasSearched(false);
            setProblemQuery("");
          }}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            searchMode === "person"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          Find a Person
        </button>
        <button
          onClick={() => {
            setSearchMode("problem");
            setHasSearched(false);
          }}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            searchMode === "problem"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          Find by Problem
        </button>
      </div>

      {searchMode === "person" ? (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-500" />
              Filters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Domain</label>
                <select
                  value={domainFilter}
                  onChange={(event) => setDomainFilter(event.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Domains</option>
                  {domainOptions.map((domain) => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">College</label>
                <select
                  value={collegeFilter}
                  onChange={(event) => setCollegeFilter(event.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Colleges</option>
                  {colleges.map((college) => (
                    <option key={college.id} value={college.name}>{college.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Graduation Year</label>
                <select
                  value={graduationYearFilter}
                  onChange={(event) => setGraduationYearFilter(event.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Any Year</option>
                  {graduationYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-3">Innovation Score</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minimumScore}
                  onChange={(event) => setMinimumScore(Number(event.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0</span>
                  <span>{minimumScore}+</span>
                  <span>100</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Patent Status</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={patentFilters.includes("Filed")}
                      onChange={(event) =>
                        setPatentFilters((current) =>
                          event.target.checked ? [...current, "Filed"] : current.filter((item) => item !== "Filed"),
                        )
                      }
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Filed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={patentFilters.includes("Granted")}
                      onChange={(event) =>
                        setPatentFilters((current) =>
                          event.target.checked ? [...current, "Granted"] : current.filter((item) => item !== "Granted"),
                        )
                      }
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Granted</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Availability</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availabilityFilters.includes("Internship")}
                      onChange={(event) =>
                        setAvailabilityFilters((current) =>
                          event.target.checked
                            ? [...current, "Internship"]
                            : current.filter((item) => item !== "Internship"),
                        )
                      }
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Internship</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availabilityFilters.includes("Full-time")}
                      onChange={(event) =>
                        setAvailabilityFilters((current) =>
                          event.target.checked
                            ? [...current, "Full-time"]
                            : current.filter((item) => item !== "Full-time"),
                        )
                      }
                      className="rounded border-slate-700 bg-slate-950 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">Full-time</span>
                  </label>
                </div>
              </div>
              <button
                onClick={handleApplyFilters}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-slate-400">
                Showing <span className="text-white font-semibold">{newMatches.length}</span> results
              </p>
              <select className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                <option>Sort by: Innovation Score</option>
                <option>Sort by: CGPA</option>
                <option>Sort by: Recent Activity</option>
              </select>
            </div>

            {newMatches.map((student) => (
              <div key={student.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                      <span className="text-white font-bold text-xl">{student.photo}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{student.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {student.college}
                        </span>
                        <span>•</span>
                        <span>{student.course}</span>
                        <span>•</span>
                        <span>Class of {student.graduationYear}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">Innovation Score</div>
                    <div className="text-2xl font-bold text-white text-center">{student.innovationScore}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {student.skills.slice(0, 5).map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4">
                  <div className="text-xs text-slate-500 mb-1">Latest Project</div>
                  <div className="font-semibold text-white mb-2">{student.latestProject}</div>
                  <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs font-semibold">
                    {student.domain}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      student.patentStatus === "Granted" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                      student.patentStatus === "Filed" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" :
                      "bg-slate-800 text-slate-500"
                    }`}>
                      {student.patentStatus === "None" ? "No Patent" : `Patent ${student.patentStatus}`}
                    </span>
                    <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                      {student.availability}
                    </span>
                    <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                      CGPA: {student.cgpa}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(getStudentPortfolioViewPath(student.id))}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Portfolio
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {!hasSearched ? (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Find Students by Problem Domain</h3>
                    <p className="text-sm text-slate-400">Discover talent who've solved similar challenges</p>
                  </div>
                </div>
                <textarea
                  value={problemQuery}
                  onChange={(e) => setProblemQuery(e.target.value)}
                  placeholder="e.g., We need to optimize last-mile delivery in tier-2 cities with minimal infrastructure..."
                  className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                  rows={4}
                />
                <button
                  onClick={() => setHasSearched(true)}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
                >
                  <Search className="w-5 h-5" />
                  Find Matching Students
                </button>
              </div>

              {examplePrompts.length > 0 ? (
                <div className="text-center">
                  <p className="text-sm text-slate-400 mb-4">Or try an example:</p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {examplePrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setProblemQuery(prompt)}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all border border-slate-700 hover:border-purple-500/50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Students with matching projects</h3>
                  <p className="text-sm text-slate-400">Found {problemMatches.length} students who've worked on similar problems</p>
                </div>
                <button
                  onClick={() => setHasSearched(false)}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Search
                </button>
              </div>
              {problemMatches.map((student) => (
                <div key={student.id} className="bg-slate-900 border-2 border-purple-500/50 rounded-xl p-6 shadow-lg shadow-purple-500/10">
                  <div className="mb-4 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg inline-block">
                    <div className="text-xs text-purple-400 font-semibold flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Matched Project: {student.latestProject}
                    </div>
                  </div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xl">{student.photo}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{student.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Building2 className="w-4 h-4" />
                          {student.college} • {student.course}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                      <div className="text-2xl font-bold text-white">{student.innovationScore}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {student.skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-sm border border-blue-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate(getStudentPortfolioViewPath(student.id))}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Eye className="w-5 h-5" />
                    View Full Portfolio
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStudentProfile = () => {
    const student =
      profileStudent ??
      newMatches.find((s) => s.id === selectedStudent) ??
      problemMatches.find((s) => s.id === selectedStudent);
    if (!student) return null;

    const isShortlisted = student.bridgeType === "HR_SHORTLIST";
    const canMessageStudent = student.canContact || isShortlisted;
    const isShortlistingThisStudent = shortlistMutation.isPending && shortlistMutation.variables === student.id;

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedStudent(null)}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
        >
          ← Back to Search
        </button>

        {/* Sticky Action Buttons */}
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">{student.photo}</span>
            </div>
            <div>
              <h3 className="font-bold text-white">{student.name}</h3>
              <p className="text-sm text-slate-400">{student.college}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportPdf}
              className="px-5 py-2 border-2 border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={() => shortlistMutation.mutate(student.id)}
              disabled={isShortlisted || isShortlistingThisStudent}
              className="px-5 py-2 border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg font-semibold transition-all disabled:opacity-60"
            >
              {isShortlisted ? "Shortlisted" : isShortlistingThisStudent ? "Shortlisting..." : "Shortlist"}
            </button>
            <button
              onClick={() => navigate(`/dashboard/recruiter/messages/${student.id}`)}
              disabled={!canMessageStudent}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              title={canMessageStudent ? "Message student" : "Shortlist this student before messaging"}
            >
              <MessageSquare className="w-5 h-5" />
              Message
            </button>
          </div>
        </div>
        {profileActionMessage ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
            {profileActionMessage}
          </div>
        ) : null}

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30">
                <span className="text-white font-bold text-3xl">{student.photo}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{student.name}</h1>
                <div className="flex items-center gap-4 text-slate-400 mb-3">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {student.college}
                  </span>
                  <span>•</span>
                  <span>{student.course}</span>
                  <span>•</span>
                  <span>Class of {student.graduationYear}</span>
                </div>
                <div className="flex gap-2">
                  <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    student.availability === "Internship"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      : "bg-green-500/10 text-green-400 border border-green-500/30"
                  }`}>
                    Available for {student.availability}
                  </span>
                  <span className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold">
                    CGPA: {student.cgpa}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 rounded-full border-8 border-yellow-500/30 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-2 shadow-xl">
                <div>
                  <div className="text-4xl font-bold text-white">{student.innovationScore}</div>
                  <div className="text-xs text-slate-400">Innovation Score</div>
                </div>
              </div>
            </div>
          </div>

          {student.about && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">About</h3>
              <p className="text-white leading-relaxed">{student.about}</p>
            </div>
          )}
        </div>

        {/* Education */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-500" />
            Education
          </h2>
          <div className="grid md:grid-cols-3 gap-4 bg-slate-950 border border-slate-800 rounded-lg p-5">
            <div>
              <div className="text-sm text-slate-400 mb-1">Degree</div>
              <div className="font-semibold text-white">{student.course}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">CGPA</div>
              <div className="font-semibold text-white">{student.cgpa} / 10.0</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Graduation Year</div>
              <div className="font-semibold text-white">{student.graduationYear}</div>
            </div>
          </div>
        </div>

        {/* Projects */}
        {student.projects && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-purple-500" />
              Innovation Projects
              <span className="ml-2 px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-sm font-semibold">
                {student.projects.length}
              </span>
            </h2>
            <div className="space-y-4">
              {student.projects.map((project) => (
                <div key={project.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-purple-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white mb-2 text-lg">{project.title}</h3>
                      <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-sm font-semibold border border-purple-500/30">
                        {project.domain}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      project.patentStatus === "Granted" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                      project.patentStatus === "Filed" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" :
                      "bg-slate-800 text-slate-500"
                    }`}>
                      {project.patentStatus === "None" ? "No Patent" : `Patent ${project.patentStatus}`}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Problem Statement</div>
                      <p className="text-slate-300 text-sm leading-relaxed">{project.problemStatement}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Role</div>
                        <div className="text-sm text-white font-semibold">{project.role}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Timeline</div>
                        <div className="text-sm text-white font-semibold">{project.timeline}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Outcome</div>
                      <p className="text-sm text-green-400 font-semibold">{project.outcome}</p>
                    </div>

                    {project.mentor && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <User className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="text-xs text-slate-500">Mentored by</div>
                          <div className="text-sm text-blue-400 font-semibold">{project.mentor}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Tech Stack</div>
                    <div className="flex flex-wrap gap-2">
                      {project.techStack.map((tech, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Skills (Auto-derived from Projects)</h2>
          <div className="flex flex-wrap gap-3">
            {student.skills.map((skill, i) => (
              <span key={i} className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg font-semibold">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Internship History */}
        {student.internships && student.internships.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-green-500" />
              Internship History
            </h2>
            <div className="space-y-3">
              {student.internships.map((internship) => (
                <div key={internship.id} className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-green-500/50 transition-all">
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">{internship.role}</h4>
                    <p className="text-sm text-slate-400 mb-2">{internship.company} • {internship.duration}</p>
                    <p className="text-sm text-slate-300">{internship.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {student.achievements && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-500" />
              Achievements
            </h2>
            <div className="space-y-3">
              {student.achievements.map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800 rounded-lg hover:border-yellow-500/50 transition-all">
                  {achievement.type === "patent" && <FileText className="w-5 h-5 text-green-400 flex-shrink-0" />}
                  {achievement.type === "competition" && <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
                  {achievement.type === "badge" && <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className="font-semibold text-white">{achievement.title}</div>
                    <div className="text-sm text-slate-400">{achievement.description}</div>
                  </div>
                  <div className="text-xs text-slate-500">{achievement.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mentor Recommendations */}
        {student.mentorRecommendations && student.mentorRecommendations.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-500" />
              Mentor Recommendations
            </h2>
            <div className="space-y-4">
              {student.mentorRecommendations.map((rec) => (
                <div key={rec.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white">{rec.mentorName}</h4>
                      <p className="text-sm text-slate-400">{rec.mentorTitle}</p>
                    </div>
                    <div className="text-xs text-slate-500">{rec.date}</div>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic">"{rec.recommendation}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCollegeConnect = () => {
    const normalizedCollegeSearch = collegeSearch.trim().toLowerCase();
    const filteredColleges = normalizedCollegeSearch
      ? colleges.filter((college) => {
          const haystack = `${college.name} ${college.city} ${college.state}`.toLowerCase();
          return haystack.includes(normalizedCollegeSearch);
        })
      : colleges;

    return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={collegeSearch}
          onChange={(event) => setCollegeSearch(event.target.value)}
          placeholder="Search institutions by name, city, or state..."
          className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {partnershipError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {partnershipError}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Total Institutions</div>
          <div className="text-2xl font-bold text-white">{colleges.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Active Students</div>
          <div className="text-2xl font-bold text-white">{colleges.reduce((sum, c) => sum + c.activeStudents, 0)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Active Drives</div>
          <div className="text-2xl font-bold text-white">{activeDrives.length}</div>
        </div>
      </div>

      {/* College Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredColleges.map((college) => (
          <div key={college.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{college.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                  <MapPin className="w-4 h-4" />
                  {college.city}, {college.state}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                college.naacGrade === "A++" ? "bg-green-900/30 text-green-400 border border-green-500/30" :
                college.naacGrade === "A+" ? "bg-green-800/30 text-green-300 border border-green-500/30" :
                college.naacGrade === "A" ? "bg-teal-800/30 text-teal-300 border border-teal-500/30" :
                "bg-amber-800/30 text-amber-300 border border-amber-500/30"
              }`}>
                NAAC {college.naacGrade}
              </span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < college.iicStars ? "text-yellow-500 fill-yellow-500" : "text-slate-600"
                    }`}
                  />
                ))}
              </div>
              {college.nirfRank && (
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-semibold border border-blue-500/30">
                  NIRF #{college.nirfRank}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{college.activeStudents}</div>
                <div className="text-xs text-slate-400">Students</div>
              </div>
              <div className="text-center border-x border-slate-800">
                <div className="text-lg font-bold text-white">{college.topDomains.length}</div>
                <div className="text-xs text-slate-400">Domains</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{college.placementVelocity}%</div>
                <div className="text-xs text-slate-400">Velocity</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2">Top Project Domains</div>
              <div className="flex flex-wrap gap-2">
                {college.topDomains.map((domain, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                    {domain}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setSelectedCollege(college.id);
                  setShowDriveModal(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-blue-500/20"
              >
                Post Campus Drive
              </button>
              <button
                type="button"
                onClick={() => partnershipMutation.mutate(college.id)}
                disabled={
                  partnershipSentFor === college.id ||
                  (partnershipMutation.isPending && partnershipMutation.variables === college.id)
                }
                className="px-4 py-2 border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {partnershipSentFor === college.id
                  ? "Request Sent"
                  : partnershipMutation.isPending && partnershipMutation.variables === college.id
                    ? "Sending..."
                    : "Request Partnership"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Drive Modal */}
      {showDriveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Post Campus Drive</h2>
              <button
                onClick={() => setShowDriveModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const title = String(formData.get("title") ?? "").trim();
                const baseDescription = String(formData.get("description") ?? "").trim();
                const deadline = String(formData.get("deadline") ?? "").trim();
                const minimumCgpa = Number(formData.get("minimumCgpa") ?? 0);
                if (!selectedCollege || !title || !baseDescription || !deadline) {
                  setDriveFormError("Drive title, description, deadline, and college are required.");
                  return;
                }
                const enriched = [
                  baseDescription,
                  driveBranches.length ? `Eligible Branches: ${driveBranches.join(", ")}.` : "",
                  driveGraduationYear ? `Graduation Year: ${driveGraduationYear}.` : "",
                  driveOpenings ? `Openings: ${driveOpenings}.` : "",
                ]
                  .filter(Boolean)
                  .join("\n");
                createDriveMutation.mutate({
                  title,
                  collegeId: selectedCollege,
                  type: "Placement Drive",
                  scheduledAt: new Date(`${deadline}T09:00:00`).toISOString(),
                  description: enriched,
                  minimumInnovationScore: Number.isFinite(minimumCgpa) ? Math.round(minimumCgpa * 100) : 0,
                });
              }}
            >
              {driveFormError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {driveFormError}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Drive Title</label>
                <input
                  name="title"
                  type="text"
                  placeholder="Software Engineering Internship 2026"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Eligible Branches (Multi-select)</label>
                <select
                  multiple
                  value={driveBranches}
                  onChange={(event) =>
                    setDriveBranches(Array.from(event.target.selectedOptions, (option) => option.value))
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  size={4}
                >
                  <option>Computer Science</option>
                  <option>Electronics & Communication</option>
                  <option>Mechanical Engineering</option>
                  <option>Electrical Engineering</option>
                  <option>AI/ML</option>
                  <option>Data Science</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Minimum CGPA</label>
                  <input
                    name="minimumCgpa"
                    type="number"
                    step="0.1"
                    placeholder="7.5"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Graduation Year</label>
                  <select
                    value={driveGraduationYear}
                    onChange={(event) => setDriveGraduationYear(event.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option>2025</option>
                    <option>2026</option>
                    <option>2027</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Number of Openings</label>
                <input
                  type="number"
                  value={driveOpenings}
                  onChange={(event) => setDriveOpenings(event.target.value)}
                  placeholder="10"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Role Description</label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Application Deadline</label>
                <input
                  name="deadline"
                  type="date"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={createDriveMutation.isPending}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-blue-500/30"
              >
                {createDriveMutation.isPending ? "Submitting..." : "Submit Campus Drive"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
    );
  };

  const renderActiveDrives = () => (
    <div className="space-y-6">
      {selectedDrive ? (
        // Pipeline View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedDrive(null)}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
            >
              ← Back to All Drives
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleExportDriveReport}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all"
              >
                Export Report
              </button>
              <button
                onClick={handleEditDrive}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all"
              >
                Edit Drive
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-2">{selectedDriveView?.name ?? "Drive Pipeline"}</h3>
            <p className="text-slate-400 mb-4">{selectedDriveView?.college ?? "College not linked"}</p>

            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedDriveView?.applications ?? 0}</div>
                <div className="text-xs text-slate-400">Applications</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedDriveView?.shortlisted ?? 0}</div>
                <div className="text-xs text-slate-400">Shortlisted</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedDriveView?.interviewed ?? 0}</div>
                <div className="text-xs text-slate-400">Interviewed</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedDriveView?.offered ?? 0}</div>
                <div className="text-xs text-slate-400">Offered</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">
                  {driveApplicants.filter((applicant) => applicant.stage === "Joined").length}
                </div>
                <div className="text-xs text-slate-400">Joined</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {["Applied", "Shortlisted", "Interviewed", "Offered", "Joined"].map((stage, i) => {
                const stageApplicants = driveApplicants.filter(a => a.stage === stage);
                return (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      {stage}
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
                        {stageApplicants.length}
                      </span>
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stageApplicants.map((applicant) => (
                        <div
                          key={applicant.id}
                          className="bg-slate-900 border border-slate-700 rounded-lg p-3 hover:border-blue-500/50 transition-all cursor-pointer"
                        >
                          <div className="font-semibold text-white text-sm mb-1">{applicant.name}</div>
                          <div className="text-xs text-slate-400 mb-2">{applicant.college}</div>
                          <div className="flex items-center justify-between">
                            <div className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
                              {applicant.innovationScore}
                            </div>
                            <div className="text-xs text-slate-500">{applicant.daysInStage}d</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeDrives.length > 0 ? (
        <>
          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-950">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Drive Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">College</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Applications</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Shortlisted</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Interviewed</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Offered</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeDrives.map((drive) => (
                  <tr key={drive.id} className="border-t border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-white font-semibold">{drive.name}</td>
                    <td className="px-6 py-4 text-slate-400">{drive.college}</td>
                    <td className="px-6 py-4 text-center text-white">{drive.applications}</td>
                    <td className="px-6 py-4 text-center text-white">{drive.shortlisted}</td>
                    <td className="px-6 py-4 text-center text-white">{drive.interviewed}</td>
                    <td className="px-6 py-4 text-center text-white">{drive.offered}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        drive.status === "Active" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                        drive.status === "Paused" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" :
                        "bg-slate-700 text-slate-400"
                      }`}>
                        {drive.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedDrive(drive.id)}
                        className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors flex items-center gap-1 mx-auto"
                      >
                        View Pipeline
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No active drives yet</h3>
          <p className="text-slate-400 mb-6">Start a Campus Drive to begin hiring</p>
          <button
            onClick={() => goToView("college-connect")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            Start a Campus Drive
          </button>
        </div>
      )}
    </div>
  );

  const renderOnboardingTracker = () => {
    const stages: Array<"Offer Sent" | "Offer Accepted" | "Documents Submitted" | "Joining Confirmed" | "Day 1" | "30-Day Check-in"> =
      ["Offer Sent", "Offer Accepted", "Documents Submitted", "Joining Confirmed", "Day 1", "30-Day Check-in"];

    return (
      <div className="space-y-6">
        {onboardingPipeline.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Onboarding Pipeline</h2>
              <div className="text-sm text-slate-400">
                Total: <span className="text-white font-semibold">{onboardingPipeline.length}</span> candidates
              </div>
            </div>

            <div className="grid grid-cols-6 gap-4">
              {stages.map((stage, i) => {
                const stageCandidates = onboardingPipeline.filter((item) => item.stage === stage);
                return (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      {stage}
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
                        {stageCandidates.length}
                      </span>
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {stageCandidates.map((item) => (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-3 ${
                            item.daysInStage > 7 ? "bg-red-900/20 border-red-500/30" :
                            item.daysInStage > 3 ? "bg-yellow-900/20 border-yellow-500/30" :
                            "bg-slate-900 border-slate-700"
                          } hover:border-blue-500/50 transition-all`}
                        >
                          <div className="font-semibold text-white text-sm mb-1">{item.name}</div>
                          <div className="text-xs text-slate-400 mb-1">{item.college}</div>
                          <div className="text-xs text-slate-400 mb-2">{item.role}</div>
                          <div className="flex items-center justify-between">
                            <div className={`text-xs ${
                              item.daysInStage > 7 ? "text-red-400" :
                              item.daysInStage > 3 ? "text-yellow-400" :
                              "text-slate-500"
                            }`}>
                              {item.daysInStage} days
                            </div>
                            <button
                              onClick={() => reminderMutation.mutate(item.studentId)}
                              disabled={
                                reminderSentFor === item.studentId ||
                                (reminderMutation.isPending && reminderMutation.variables === item.studentId)
                              }
                              className="text-blue-400 hover:text-blue-300 text-xs transition-colors disabled:opacity-50"
                              title={reminderSentFor === item.studentId ? "Reminder sent" : "Send Reminder"}
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div className="text-sm text-slate-300">
                <span className="text-yellow-400 font-semibold">{onboardingPipeline.filter(c => c.daysInStage > 3).length}</span> candidates
                have been in their current stage for more than 3 days. Consider sending reminders.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No students in onboarding yet</h3>
            <p className="text-slate-400 mb-6">Complete a hiring drive to see them here</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Content */}
      {selectedStudent ? (
        renderStudentProfile()
      ) : currentView === "home" ? (
        renderHome()
      ) : currentView === "talent-search" ? (
        renderTalentSearch()
      ) : currentView === "college-connect" ? (
        renderCollegeConnect()
      ) : currentView === "active-drives" ? (
        renderActiveDrives()
      ) : (
        renderOnboardingTracker()
      )}

      {/* Job Creation Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Post a Job</h2>
              <button
                onClick={() => {
                  setShowJobModal(false);
                  setJobFormError("");
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitJob();
              }}
            >
              {jobFormError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {jobFormError}
                </div>
              ) : null}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Job Title</label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
                    placeholder="Software Engineer"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Company</label>
                  <input
                    type="text"
                    value={jobForm.company}
                    onChange={(event) => setJobForm({ ...jobForm, company: event.target.value })}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Domain</label>
                  <input
                    type="text"
                    value={jobForm.domain}
                    onChange={(event) => setJobForm({ ...jobForm, domain: event.target.value })}
                    placeholder="AI / ML"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Location</label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })}
                    placeholder="Bangalore, India"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Type</label>
                  <select
                    value={jobForm.type}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        type: event.target.value as typeof jobForm.type,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Work Mode</label>
                  <select
                    value={jobForm.workMode}
                    onChange={(event) =>
                      setJobForm({
                        ...jobForm,
                        workMode: event.target.value as typeof jobForm.workMode,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Openings</label>
                  <input
                    type="number"
                    min={1}
                    value={jobForm.openings}
                    onChange={(event) => setJobForm({ ...jobForm, openings: event.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Minimum Innovation Score</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={jobForm.minimumInnovationScore}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, minimumInnovationScore: event.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Job Description</label>
                <textarea
                  rows={5}
                  value={jobForm.description}
                  onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })}
                  placeholder="Describe the role, responsibilities, and qualifications..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={createJobMutation.isPending}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 disabled:opacity-60"
              >
                {createJobMutation.isPending ? "Posting..." : "Post Job"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecruiterDashboardHome() {
  return <RecruiterDashboardExperience initialView="home" />;
}

export function RecruiterTalentSearchView() {
  return <RecruiterDashboardExperience initialView="talent-search" />;
}

export function RecruiterCollegeConnectView() {
  return <RecruiterDashboardExperience initialView="college-connect" />;
}

export function RecruiterActiveDrivesView() {
  return <RecruiterDashboardExperience initialView="active-drives" />;
}

export function RecruiterOnboardingTrackerView() {
  return <RecruiterDashboardExperience initialView="onboarding" />;
}

export default RecruiterDashboardHome;
