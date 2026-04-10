import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collegeApi } from "../../api/college.api";
import { schoolApi } from "../../api/school.api";
import { startupApi } from "../../api/startup.api";
import { userApi } from "../../api/user.api";
import type { CollegeDashboardData } from "../../types/college.types";
import type { SchoolDashboardData } from "../../types/school.types";
import { useInnovationScore } from "../../hooks/useInnovationScore";
import { useAuthStore } from "../../store/authStore";
import { UserRole } from "../../types/roles.types";
import { DashboardLayout } from "../components/DashboardLayout";
import { EducationSection } from "./portfolio/components/EducationSection";
import { ExperienceSection } from "./portfolio/components/ExperienceSection";
import { InstitutionInsightsSection } from "./portfolio/components/InstitutionInsightsSection";
import { PortfolioHero } from "./portfolio/components/PortfolioHero";
import { SkillsFeaturedSection } from "./portfolio/components/SkillsFeaturedSection";
import { StartupList } from "./portfolio/components/StartupList";

function formatMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function toTitleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Portfolio() {
  const authUser = useAuthStore((state) => state.user);
  const resolvedRole = authUser?.role ?? UserRole.STUDENT;
  const isStudentRole = resolvedRole === UserRole.STUDENT;

  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: () => userApi.getMe() });
  const score = useInnovationScore({ enabled: isStudentRole });
  const startups = useQuery({
    queryKey: ["startup", "mine"],
    queryFn: () => startupApi.mine(),
    enabled: isStudentRole,
  });
  const institutionDashboardQuery = useQuery<SchoolDashboardData | CollegeDashboardData>({
    queryKey: ["institution", "dashboard", resolvedRole],
    queryFn: () =>
      resolvedRole === UserRole.COLLEGE ? collegeApi.getDashboard() : schoolApi.getDashboard(),
    enabled: resolvedRole === UserRole.SCHOOL || resolvedRole === UserRole.COLLEGE,
  });

  const profile = profileQuery.data;
  const isInstitutionRole = resolvedRole === UserRole.SCHOOL || resolvedRole === UserRole.COLLEGE;
  const institutionProfile = profile?.institutionProfile ?? institutionDashboardQuery.data?.institutionProfile;
  const institutionStats =
    profile?.institutionProfile?.stats ?? institutionDashboardQuery.data?.institutionProfile?.stats;
  const institutionOverviewProfile = institutionDashboardQuery.data?.institutionProfile ?? institutionProfile;
  const institutionOverviewStats = institutionDashboardQuery.data?.institutionProfile?.stats ?? institutionStats;
  const schoolDashboard =
    resolvedRole === UserRole.SCHOOL
      ? (institutionDashboardQuery.data as Awaited<ReturnType<typeof schoolApi.getDashboard>> | undefined)
      : undefined;
  const collegeDashboard =
    resolvedRole === UserRole.COLLEGE
      ? (institutionDashboardQuery.data as Awaited<ReturnType<typeof collegeApi.getDashboard>> | undefined)
      : undefined;
  const institutionPolicies =
    ((institutionOverviewProfile as { policies?: Array<{ name: string; status: string }> } | undefined)?.policies ??
      []);

  const displayName = profile?.displayName ?? authUser?.displayName ?? "Portfolio";
  const institutionName = institutionProfile?.institutionName ?? displayName;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const location =
    institutionDashboardQuery.data?.institutionProfile?.location ??
    institutionProfile?.location ??
    profile?.location ??
    "Location not added";
  const primaryRole = profile?.headline ?? (isInstitutionRole ? "Institution Lead" : "Innovation Contributor");
  const innovationScore = isStudentRole ? score.data?.score ?? profile?.innovationScore ?? 0 : 0;

  const currentExperience = useMemo(() => {
    const experience = profile?.experience ?? [];
    return experience.find((item) => item.isCurrent) ?? experience[0] ?? null;
  }, [profile?.experience]);

  const heroPrimaryRole = isInstitutionRole
    ? primaryRole
    : currentExperience?.title ?? profile?.headline ?? primaryRole;
  const heroTitle = isInstitutionRole
    ? institutionName
    : currentExperience?.company ?? profile?.domain ?? displayName;
  const heroName = !isInstitutionRole || displayName !== heroTitle ? displayName : undefined;

  const institutionHeroDetails = useMemo(
    () => [
      {
        label: "Organization",
        value:
          institutionOverviewProfile?.organizationType ??
          (resolvedRole === UserRole.SCHOOL ? "School" : "College"),
      },
      { label: "Location", value: location },
      { label: "Academic Year", value: institutionOverviewProfile?.academicYear ?? "Not added" },
    ],
    [institutionOverviewProfile?.academicYear, institutionOverviewProfile?.organizationType, location, resolvedRole],
  );

  const previousEntries = useMemo(
    () =>
      (profile?.experience ?? [])
        .filter((item) => item._id !== currentExperience?._id)
        .slice(0, 3)
        .map((item) => ({
          company: item.company,
          role: item.title,
        })),
    [currentExperience?._id, profile?.experience],
  );

  const aboutText =
    profile?.bio?.trim() ||
    (isInstitutionRole
      ? "No institution overview added yet."
      : `${displayName} is building a portfolio around innovation, execution, and measurable outcomes.`);

  const experienceItems = (profile?.experience ?? []).map((item) => ({
    id: item._id,
    title: item.title,
    company: item.company,
    location: item.location,
    period: `${formatMonthYear(item.startDate)} - ${item.isCurrent ? "currently" : formatMonthYear(item.endDate)}`,
  }));

  const educationItems = (profile?.education ?? []).map((item) => ({
    id: item._id,
    period: `${item.startYear ?? ""} - ${item.isCurrent ? "Present" : item.endYear ?? ""}`,
    institution: item.institution,
    details: [item.degree, item.fieldOfStudy, item.description].filter(Boolean).join(", "),
  }));

  const skills = (profile?.skills ?? []).map((item) => item.name);
  const featuredItems = (profile?.portfolioProjects ?? []).map((project) => ({
    id: project._id,
    title: project.title,
    subtitle: project.description || project.techStack.slice(0, 3).join(", "),
  }));

  const startupItems = useMemo(
    () =>
      [...(startups.data ?? [])]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 6)
        .map((startup) => ({
          id: startup._id,
          title: startup.name || "Untitled Startup",
          description: startup.tagline || "No startup description added yet.",
          tags: [startup.category, startup.stage].filter((item): item is string => Boolean(item)).slice(0, 3),
          status:
            startup.stage === "Launched"
              ? "Launched"
              : startup.reviewStatus === "approved"
                ? "Approved"
                : startup.reviewStatus === "draft"
                  ? "Draft"
                  : toTitleCase(startup.reviewStatus),
        })),
    [startups.data],
  );

  const profileStrengthStats = isStudentRole
    ? [
        { label: "Innovation Score", value: innovationScore },
        { label: "Projects", value: featuredItems.length },
        { label: "Skills", value: skills.length },
        { label: "Certifications", value: profile?.certifications?.length ?? 0 },
      ]
    : [
        { label: "Experience", value: experienceItems.length },
        { label: "Skills", value: skills.length },
        { label: "Projects", value: featuredItems.length },
        { label: "Education", value: educationItems.length },
      ];

  const institutionFields =
    resolvedRole === UserRole.SCHOOL
      ? [
          { label: "Organization", value: institutionOverviewProfile?.organizationType ?? "School" },
          { label: "Academic Year", value: institutionOverviewProfile?.academicYear ?? "Not added" },
          { label: "IIC Rating", value: institutionOverviewProfile?.iicStarRating ?? 0 },
          { label: "Founded", value: institutionOverviewProfile?.foundedYear ?? "Not added" },
          { label: "Students", value: institutionOverviewProfile?.totalStudentsEnrolled ?? 0 },
          { label: "Mentoring Hours", value: institutionOverviewStats?.totalMentoringHours ?? 0 },
          { label: "Patents Filed", value: institutionOverviewStats?.patentsFiled ?? 0 },
          { label: "Contact Email", value: institutionOverviewProfile?.contactEmail ?? "Not added" },
        ]
      : [
          { label: "Organization", value: institutionOverviewProfile?.organizationType ?? "College" },
          { label: "Academic Year", value: institutionOverviewProfile?.academicYear ?? "Not added" },
          { label: "Students", value: institutionOverviewProfile?.totalStudentsEnrolled ?? 0 },
          { label: "Students Placed", value: institutionOverviewStats?.studentsPlaced ?? 0 },
          { label: "HR Connections", value: institutionOverviewStats?.totalHRConnections ?? 0 },
          { label: "Collaborations", value: institutionOverviewStats?.industryCollaborations ?? 0 },
          { label: "Hiring Sector", value: institutionOverviewStats?.topHiringSector ?? "Not added" },
          { label: "Contact Phone", value: institutionOverviewProfile?.contactPhone ?? "Not added" },
        ];

  const institutionTrendGraph = schoolDashboard?.trendGraph ?? collegeDashboard?.trendGraph;

  if (!authUser) {
    return null;
  }

  return (
    <DashboardLayout role={resolvedRole}>
      <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-[#050816] px-4 py-6 text-slate-100 lg:-mx-8 lg:px-8">
        {profileQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Loading portfolio...
          </div>
        ) : profileQuery.isError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            Unable to load your portfolio right now.
          </div>
        ) : (
          <div className="space-y-8">
            {isInstitutionRole ? (
              <>
                <PortfolioHero
                  initials={initials}
                  avatarUrl={profile?.avatar}
                  name={heroName}
                  primaryRole={heroPrimaryRole}
                  title={heroTitle}
                  detailsLabel="Overview"
                  details={institutionHeroDetails}
                />
                <InstitutionInsightsSection
                  role={resolvedRole}
                  aboutText={aboutText}
                  fields={institutionFields}
                  trendGraph={institutionTrendGraph}
                  specialties={institutionOverviewProfile?.specialties ?? []}
                  locations={institutionOverviewProfile?.locations ?? []}
                  policies={institutionPolicies.map((policy) => ({
                    name: policy.name,
                    status: policy.status,
                  }))}
                />
              </>
            ) : (
              <div className="space-y-10">
                <PortfolioHero
                  initials={initials}
                  avatarUrl={profile?.avatar}
                  name={heroName}
                  primaryRole={heroPrimaryRole}
                  title={heroTitle}
                  previousEntries={previousEntries}
                  stats={profileStrengthStats}
                  innovationScore={isStudentRole ? innovationScore : undefined}
                />

                <ExperienceSection items={experienceItems} />
                <SkillsFeaturedSection skills={skills} featured={featuredItems} />
                <EducationSection items={educationItems} />

                {resolvedRole === UserRole.STUDENT ? <StartupList startups={startupItems} /> : null}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
