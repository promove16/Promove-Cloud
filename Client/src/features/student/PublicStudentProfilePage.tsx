import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  MapPin,
  Globe,
  Github,
  Linkedin,
  ExternalLink,
  GraduationCap,
  PencilLine,
  Star,
  GitFork,
  Link2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { userApi, type PublicStudentProfile, type ProfileSkill } from '../../api/user.api';
import { useAuthStore } from '../../store/authStore';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ViewRole = 'student' | 'school' | 'college' | 'mentor' | 'investor' | 'recruiter';

const VIEW_ROLES: { id: ViewRole; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'school', label: 'School' },
  { id: 'college', label: 'College' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'investor', label: 'Investor' },
  { id: 'recruiter', label: 'Recruiter' },
];

type SectionId =
  | 'about'
  | 'academics'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'certifications'
  | 'github'
  | 'achievements'
  | 'contact';

interface SectionMeta {
  overline: string;
  title: string;
  subtitle?: string;
}

interface RoleDefinition {
  tag: string;
  heroMeta: string;
  ctaLabel: string;
  frameNote: string;
  accentDot: string;
  sectionOrder: SectionId[];
  hidden: SectionId[];
  labels: Partial<Record<SectionId, SectionMeta>>;
}

const ROLE_DEFINITIONS: Record<ViewRole, RoleDefinition> = {
  student: {
    tag: 'Portfolio',
    heroMeta: 'Learning · Building · Creating',
    ctaLabel: 'Connect',
    frameNote: 'Personal view — how this student presents their own growth, work, and journey.',
    accentDot: 'bg-zinc-400',
    sectionOrder: ['about', 'projects', 'skills', 'experience', 'academics', 'certifications', 'github', 'achievements', 'contact'],
    hidden: [],
    labels: {
      about: { overline: 'Introduction', title: 'About Me' },
      projects: { overline: 'Work', title: "What I've Built" },
      skills: { overline: 'Capabilities', title: 'Skills & Tools' },
      experience: { overline: 'Journey', title: "Places I've Worked" },
      academics: { overline: 'Education', title: 'Academic Background' },
      certifications: { overline: 'Learning', title: 'Courses & Certifications' },
      github: { overline: 'Open Source', title: 'Code Activity' },
      achievements: { overline: 'Milestones', title: 'Progress & Achievements' },
      contact: { overline: 'Connect', title: 'Get In Touch' },
    },
  },
  school: {
    tag: 'Academic Profile',
    heroMeta: 'Enrolled Student · Development Record',
    ctaLabel: 'View Academic Record',
    frameNote: 'School view — academic record, extracurriculars, and institutional progress indicators.',
    accentDot: 'bg-indigo-400',
    sectionOrder: ['academics', 'about', 'achievements', 'certifications', 'skills', 'experience', 'projects', 'contact'],
    hidden: ['github'],
    labels: {
      academics: { overline: 'Enrollment & History', title: 'Academic Record', subtitle: 'Current institution and prior education history' },
      about: { overline: 'Student Overview', title: 'Profile Summary' },
      achievements: { overline: 'Progress Indicators', title: 'Academic Achievements & Scores' },
      certifications: { overline: 'Development', title: 'Completed Courses & Certifications' },
      skills: { overline: 'Competencies', title: 'Demonstrated Skills' },
      experience: { overline: 'Extracurriculars', title: 'Activities & Engagements' },
      projects: { overline: 'Work Submitted', title: 'Academic & Co-curricular Projects' },
      contact: { overline: 'Student Info', title: 'Contact Details' },
    },
  },
  college: {
    tag: 'College Application',
    heroMeta: 'Applicant Profile · Merit Overview',
    ctaLabel: 'Evaluate Application',
    frameNote: 'College view — merit-based profile for admissions assessment. Emphasizes academic strength, certifications, and research exposure.',
    accentDot: 'bg-violet-400',
    sectionOrder: ['about', 'academics', 'achievements', 'projects', 'certifications', 'skills', 'experience', 'contact'],
    hidden: ['github'],
    labels: {
      about: { overline: 'Statement', title: 'Profile Summary', subtitle: 'Academic readiness and stated intent' },
      academics: { overline: 'Education History', title: 'Academic Background', subtitle: 'Institutions, degrees, and performance indicators' },
      achievements: { overline: 'Recognition', title: 'Achievements, Awards & Innovation Score' },
      projects: { overline: 'Research & Contributions', title: 'Academic Projects & Work' },
      certifications: { overline: 'Credentials', title: 'Certifications & Completed Courses' },
      skills: { overline: 'Subject Strengths', title: 'Skills & Competencies' },
      experience: { overline: 'Leadership Exposure', title: 'Internships, Research & Volunteer Work' },
      contact: { overline: 'Admissions Inquiry', title: 'Contact & External Profiles' },
    },
  },
  mentor: {
    tag: 'Mentee Profile',
    heroMeta: 'Mentorship Context · Coaching Overview',
    ctaLabel: 'Begin Mentoring',
    frameNote: 'Mentor view — diagnostic profile. Shows skill proficiency levels, project maturity, and consistency signals to help guide this student.',
    accentDot: 'bg-amber-400',
    sectionOrder: ['about', 'skills', 'projects', 'github', 'experience', 'academics', 'certifications', 'achievements', 'contact'],
    hidden: [],
    labels: {
      about: { overline: 'Learner Context', title: 'Who They Are & What They Need', subtitle: 'Background, goals, and self-described direction' },
      skills: { overline: 'Skill Inventory', title: 'Current Skills & Proficiency Levels', subtitle: 'Assess strengths and identify learning gaps' },
      projects: { overline: 'Project Maturity', title: 'Work in Progress & Completed Projects', subtitle: 'Evaluate depth, scope, and technical confidence' },
      github: { overline: 'Consistency Signal', title: 'Code Habits & Activity Patterns' },
      experience: { overline: 'Real-World Exposure', title: 'Work Experience & Engagements' },
      academics: { overline: 'Foundation', title: 'Academic Background' },
      certifications: { overline: 'Self-Learning Signals', title: 'Independent Study & Certifications' },
      achievements: { overline: 'Progress Milestones', title: 'Achievements & Innovation Score' },
      contact: { overline: 'Connect', title: 'Reach Out' },
    },
  },
  investor: {
    tag: 'Investor View',
    heroMeta: 'Builder Profile · Execution Signals',
    ctaLabel: 'Express Interest',
    frameNote: "Investor view — surfaces builder velocity, initiative, project execution, and ambition. This is not a pitch deck — it's a profile.",
    accentDot: 'bg-emerald-400',
    sectionOrder: ['about', 'achievements', 'projects', 'github', 'experience', 'skills', 'academics', 'contact'],
    hidden: ['certifications'],
    labels: {
      about: { overline: 'Founder Signal', title: 'Vision, Drive & Initiative', subtitle: "Self-described goals and what they're building toward" },
      achievements: { overline: 'Execution Proof', title: 'Innovation Score & Traction Indicators' },
      projects: { overline: 'Product Thinking', title: "What They've Shipped", subtitle: 'Real execution evidence — products, prototypes, and side projects' },
      github: { overline: 'Technical Signal', title: 'Code Output & Builder Velocity' },
      experience: { overline: 'Track Record', title: 'Roles, Initiatives & Exposure' },
      skills: { overline: 'Capability Stack', title: 'Technical & Non-Technical Skills' },
      academics: { overline: 'Context', title: 'Academic Background' },
      contact: { overline: 'Next Step', title: 'Start a Conversation' },
    },
  },
  recruiter: {
    tag: 'Recruiter View',
    heroMeta: 'Open to Opportunities',
    ctaLabel: 'Shortlist Candidate',
    frameNote: 'Recruiter view — skills, proof of work, experience, and hire-readiness signals. Structured for fast, accurate assessment.',
    accentDot: 'bg-sky-400',
    sectionOrder: ['skills', 'experience', 'projects', 'academics', 'certifications', 'achievements', 'github', 'about', 'contact'],
    hidden: [],
    labels: {
      skills: { overline: 'Technical Stack', title: 'Skills & Technologies', subtitle: 'Tools, frameworks, and areas of expertise' },
      experience: { overline: 'Work History', title: 'Experience & Internships' },
      projects: { overline: 'Proof of Work', title: 'Projects, Outcomes & Links' },
      academics: { overline: 'Qualifications', title: 'Education' },
      certifications: { overline: 'Verified Credentials', title: 'Certifications & Training' },
      achievements: { overline: 'Performance Indicators', title: 'Scores & Recognition' },
      github: { overline: 'Code Activity', title: 'GitHub Signal' },
      about: { overline: 'Candidate Summary', title: 'Profile Overview' },
      contact: { overline: 'Hire', title: 'Contact & Resume' },
    },
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SKILL_LEVELS: Record<string, { label: string; width: number }> = {
  beginner: { label: 'Beginner', width: 20 },
  intermediate: { label: 'Intermediate', width: 50 },
  advanced: { label: 'Advanced', width: 75 },
  expert: { label: 'Expert', width: 95 },
};

const CATEGORY_ORDER = ['programming', 'design', 'business', 'research', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  programming: 'Engineering & Development',
  design: 'Design & Visual',
  business: 'Business & Strategy',
  research: 'Research & Analysis',
  other: 'Other',
};

function groupSkillsByCategory(skills: ProfileSkill[]) {
  const grouped: Record<string, ProfileSkill[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.category]) grouped[skill.category] = [];
    grouped[skill.category].push(skill);
  }
  return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => ({
    category: cat,
    skills: grouped[cat],
  }));
}

const EXP_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  internship: 'Internship',
  freelance: 'Freelance',
  volunteer: 'Volunteer',
};

// ─────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────

function Overline({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-500 ${className}`}>
      {children}
    </p>
  );
}

function EmptyState({
  message,
  ownProfileTitle,
}: {
  message: string;
  ownProfileTitle?: string;
}) {
  if (!ownProfileTitle) {
    return <p className="text-sm italic text-zinc-700">{message}</p>;
  }

  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 px-5 py-4">
      <div className="text-sm font-medium text-zinc-100">{ownProfileTitle}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
      <Link
        to="/dashboard/profile"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
      >
        Edit Profile
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Divider() {
  return <div className="my-8 border-t border-zinc-800/60" />;
}

const OWN_PROFILE_EMPTY_STATE_COPY: Record<
  Exclude<SectionId, 'achievements'>,
  { title: string; message: string }
> = {
  about: {
    title: 'Add your summary',
    message:
      'Write a short profile summary so visitors understand what you build, what you care about, and where you want to grow.',
  },
  academics: {
    title: 'Add your education',
    message:
      'Add your current or past education so your background is clear to recruiters, mentors, and collaborators.',
  },
  skills: {
    title: 'Add your skills',
    message:
      'List the skills and tools you actually use so this profile shows stronger proof of capability.',
  },
  projects: {
    title: 'Add your projects',
    message:
      'Show what you have built with links, context, and outcomes so this page feels complete.',
  },
  experience: {
    title: 'Add your experience',
    message:
      'Capture internships, roles, research, or volunteer work to strengthen your work history signal.',
  },
  certifications: {
    title: 'Add your certifications',
    message:
      'Add any verified learning and credentials that support your profile.',
  },
  github: {
    title: 'Add your GitHub signal',
    message:
      'Connect GitHub or import repository activity so your public profile shows real code output instead of an empty section.',
  },
  contact: {
    title: 'Add your contact links',
    message:
      'Add GitHub, LinkedIn, or your website so people can follow up without hitting a dead end.',
  },
};

function renderMissingSectionState(
  sectionId: Exclude<SectionId, 'achievements'>,
  isOwnProfile: boolean,
  defaultMessage: string,
) {
  if (!isOwnProfile) {
    return <EmptyState message={defaultMessage} />;
  }

  const copy = OWN_PROFILE_EMPTY_STATE_COPY[sectionId];
  return <EmptyState message={copy.message} ownProfileTitle={copy.title} />;
}

// ─────────────────────────────────────────────
// Section: About
// ─────────────────────────────────────────────

function AboutSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const bio = profile.bio || profile.headline;

  const contextNote: Partial<Record<ViewRole, string>> = {
    mentor:
      'Use this overview to understand their learning context before diving into skills and gaps.',
    investor:
      'Look for initiative signals — how they describe themselves reveals ambition and self-awareness.',
    recruiter: 'Quick candidate summary. Detailed skills and experience follow below.',
    college: "Applicant's self-written profile statement.",
    school: "Student's self-written introduction.",
  };

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}
      {bio ? (
        <p className="max-w-prose text-[15px] leading-relaxed text-zinc-300">{bio}</p>
      ) : (
        renderMissingSectionState('about', isOwnProfile, 'No profile summary available.')
      )}
      {contextNote[role] && (
        <p className="mt-5 text-[12px] italic text-zinc-600">{contextNote[role]}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Academics
// ─────────────────────────────────────────────

function AcademicsSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const { education } = profile;
  const showActivities = role !== 'recruiter';

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}

      {education.length > 0 ? (
        <div className="space-y-8">
          {education.map((ed, i) => (
            <div key={ed._id} className={i > 0 ? 'pt-8 border-t border-zinc-800/50' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-medium text-zinc-100">{ed.institution}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {[ed.degree, ed.fieldOfStudy].filter(Boolean).join(' · ')}
                  </p>
                  {ed.grade && (
                    <p className="mt-1 text-xs text-zinc-600">Grade / Score: {ed.grade}</p>
                  )}
                  {ed.activities && showActivities && (
                    <p className="mt-2 text-sm text-zinc-500">{ed.activities}</p>
                  )}
                  {ed.description && role === 'college' && (
                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{ed.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                  {ed.startYear ? `${ed.startYear} — ` : ''}
                  {ed.isCurrent ? 'Present' : ed.endYear ?? ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        renderMissingSectionState('academics', isOwnProfile, 'No education entries added.')
      )}

      {profile.institution && (
        <>
          <Divider />
          <div>
            <Overline className="mb-2">Current Institution</Overline>
            <p className="text-sm text-zinc-300">{profile.institution.displayName}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Skills
// ─────────────────────────────────────────────

function SkillsSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const { skills } = profile;
  const grouped = groupSkillsByCategory(skills);

  // Mentor: proficiency bars for gap analysis
  // Recruiter: flat inline list for quick scan
  // Others: grouped list with level labels
  const isRecruiter = role === 'recruiter';
  const isMentor = role === 'mentor';

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}

      {skills.length > 0 ? (
        isRecruiter ? (
          /* Recruiter: dense inline list, quick scan */
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {skills.map((skill) => (
              <div key={skill.name} className="flex items-baseline gap-2">
                <span className="text-[14px] font-medium text-zinc-200">{skill.name}</span>
                <span className="text-[11px] text-zinc-600">
                  {SKILL_LEVELS[skill.level]?.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Grouped by category */
          <div className="space-y-10">
            {grouped.map(({ category, skills: catSkills }) => (
              <div key={category}>
                <p className="mb-5 text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                  {CATEGORY_LABELS[category] || category}
                </p>
                <div className="space-y-4">
                  {catSkills.map((skill) => (
                    <div key={skill.name} className="flex items-center gap-5">
                      <span className="w-40 shrink-0 text-[13px] text-zinc-300">{skill.name}</span>
                      {isMentor ? (
                        /* Mentor: visual proficiency bar for gap diagnosis */
                        <div className="flex flex-1 max-w-[220px] flex-col gap-1">
                          <div className="h-px bg-zinc-800 relative">
                            <div
                              className="absolute left-0 top-0 h-px bg-zinc-500 transition-all"
                              style={{ width: `${SKILL_LEVELS[skill.level]?.width ?? 50}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-600">
                            {SKILL_LEVELS[skill.level]?.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">
                          {SKILL_LEVELS[skill.level]?.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        renderMissingSectionState('skills', isOwnProfile, 'No skills have been added yet.')
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Projects
// ─────────────────────────────────────────────

function ProjectsSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const { portfolioProjects } = profile;
  const maxProjects = role === 'investor' ? 4 : role === 'recruiter' ? 6 : 5;
  const visible = portfolioProjects.slice(0, maxProjects);

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}

      {visible.length > 0 ? (
        <div className="space-y-10">
          {visible.map((project, index) => (
            <div
              key={project._id}
              className={index > 0 ? 'pt-10 border-t border-zinc-800/50' : ''}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 text-[11px] font-medium tabular-nums text-zinc-700">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-[15px] font-medium text-zinc-100">{project.title}</h3>
                    {project.stars > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                        <Star className="h-3 w-3" />
                        {project.stars}
                      </span>
                    )}
                    {project.forks > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                        <GitFork className="h-3 w-3" />
                        {project.forks}
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-zinc-400">
                      {project.description}
                    </p>
                  )}

                  {/* Tech stack - emphasized for recruiter & investor */}
                  {(role === 'recruiter' || role === 'investor') &&
                    project.techStack.length > 0 && (
                      <p className="mt-3 text-xs text-zinc-500">
                        {project.techStack.slice(0, 6).join(' · ')}
                      </p>
                    )}

                  {/* Languages for others */}
                  {role !== 'recruiter' && role !== 'investor' && project.languages.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-600">
                      {project.languages.slice(0, 4).join(' · ')}
                    </p>
                  )}

                  {/* Date range */}
                  {project.startDate && (
                    <p className="mt-2 text-xs text-zinc-700">
                      {formatDate(project.startDate)}
                      {project.isCurrent
                        ? ' — Present'
                        : project.endDate
                        ? ` — ${formatDate(project.endDate)}`
                        : ''}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-5">
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                      >
                        <Github className="h-3.5 w-3.5" />
                        Repository
                      </a>
                    )}
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Live Demo
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        renderMissingSectionState('projects', isOwnProfile, 'No projects have been added yet.')
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Experience
// ─────────────────────────────────────────────

function ExperienceSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const { experience } = profile;
  const showDescription = role !== 'school';
  const showSkills = role === 'recruiter' || role === 'mentor';

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}

      {experience.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute bottom-2 left-0 top-2 w-px bg-zinc-800/80" />
          <div className="space-y-8 pl-6">
            {experience.map((item, index) => (
              <div key={item._id} className="relative">
                <div
                  className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-zinc-800 ${
                    index === 0 ? 'bg-zinc-400' : 'bg-zinc-800'
                  }`}
                />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 text-sm text-zinc-400">{item.company}</p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {EXP_TYPE_LABELS[item.type] || item.type}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                    {item.description && showDescription && (
                      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-zinc-500">
                        {item.description}
                      </p>
                    )}
                    {item.skills.length > 0 && showSkills && (
                      <p className="mt-2 text-xs text-zinc-600">
                        {item.skills.slice(0, 5).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                    {formatDate(item.startDate)} —{' '}
                    {item.isCurrent ? 'Present' : formatDate(item.endDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        renderMissingSectionState('experience', isOwnProfile, 'No experience added yet.')
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Certifications
// ─────────────────────────────────────────────

function CertificationsSection({
  profile,
  meta,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  isOwnProfile: boolean;
}) {
  const { certifications } = profile;

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-6 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>

      {certifications.length > 0 ? (
        <div className="space-y-6">
          {certifications.map((cert, index) => (
            <div
              key={cert._id}
              className={index > 0 ? 'pt-6 border-t border-zinc-800/50' : ''}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] font-medium text-zinc-100">{cert.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">{cert.issuingOrganization}</p>
                  {cert.issueDate && (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      Issued {formatDate(cert.issueDate)}
                      {cert.expiryDate ? ` · Expires ${formatDate(cert.expiryDate)}` : ''}
                    </p>
                  )}
                </div>
                {cert.credentialUrl && (
                  <a
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    Verify ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        renderMissingSectionState('certifications', isOwnProfile, 'No certifications added yet.')
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: GitHub
// ─────────────────────────────────────────────

function GitHubSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const { githubStats, githubProof } = profile;
  const activityCount = role === 'investor' ? 3 : 5;
  const recentActivity = githubProof.recentActivity.slice(0, activityCount);

  const noData = githubStats.totalRepos === 0 && githubProof.recentActivity.length === 0;

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-1 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>
      {meta.subtitle && <p className="mb-6 text-[13px] text-zinc-500">{meta.subtitle}</p>}
      {!meta.subtitle && <div className="mb-6" />}

      {noData ? (
        renderMissingSectionState('github', isOwnProfile, 'No GitHub activity data available.')
      ) : (
        <>
          {/* Stats — inline, no boxes */}
          <div className="mb-10 flex flex-wrap gap-8">
            {[
              { label: 'Repositories', value: githubStats.totalRepos },
              { label: 'Stars', value: githubStats.totalStars },
              { label: 'Forks', value: githubStats.totalForks },
              { label: '30-Day Commits', value: githubProof.commitCount30Days },
              { label: 'Active Days', value: githubProof.activeDays30Days },
            ]
              .filter((stat) => stat.value > 0)
              .map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-light tabular-nums text-zinc-100">{stat.value}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  {stat.label}
                </p>
              </div>
              ))}
          </div>

          {/* Top languages */}
          {githubStats.topLanguages.length > 0 && (
            <div className="mb-10">
              <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                Top Languages
              </p>
              <div className="max-w-[300px] space-y-3">
                {githubStats.topLanguages.slice(0, 5).map((lang) => (
                  <div key={lang.language} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px] text-zinc-400 truncate">
                      {lang.language}
                    </span>
                    <div className="relative flex-1 h-px bg-zinc-800">
                      <div
                        className="absolute left-0 top-0 h-px bg-zinc-500"
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-zinc-600">
                      {lang.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                Recent Activity
              </p>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm text-zinc-300">{activity.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-600">{activity.repoFullName}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                      {new Date(activity.occurredAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Achievements
// ─────────────────────────────────────────────

function AchievementsSection({
  profile,
  meta,
  role,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
}) {
  const { innovationScore, githubProof, skills, portfolioProjects, certifications } = profile;

  const metrics = [
    { label: 'Innovation Score', value: innovationScore, show: true },
    { label: 'Projects Built', value: portfolioProjects.length, show: true },
    { label: 'Skills', value: skills.length, show: true },
    {
      label: 'Certifications',
      value: certifications.length,
      show: certifications.length > 0,
    },
    {
      label: '30-Day Commits',
      value: githubProof.commitCount30Days,
      show: role === 'investor' || role === 'mentor',
    },
    {
      label: 'Active Days / Month',
      value: githubProof.activeDays30Days,
      show: role === 'mentor',
    },
  ].filter((m) => m.show);

  const contextNote: Partial<Record<ViewRole, string>> = {
    investor:
      'Innovation Score reflects builder momentum across verified platform activity — skills completed, project milestones, patent submissions, and startup progress.',
    college:
      'Innovation Score is computed from verified platform activity, project completions, and milestone indicators — not self-reported.',
    mentor:
      'Use these metrics as a baseline for goal-setting. Compare against skills section for depth vs. breadth gaps.',
  };

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-6 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>

      <div className="flex flex-wrap gap-10">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="text-3xl font-light tabular-nums text-zinc-100">{metric.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      {contextNote[role] && (
        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-zinc-600">
          {contextNote[role]}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section: Contact
// ─────────────────────────────────────────────

function ContactSection({
  profile,
  meta,
  role,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  meta: SectionMeta;
  role: ViewRole;
  isOwnProfile: boolean;
}) {
  const socialLinks = [
    { label: 'GitHub', url: profile.githubUrl, icon: Github },
    { label: 'LinkedIn', url: profile.linkedinUrl, icon: Linkedin },
    { label: 'Website', url: profile.websiteUrl, icon: Globe },
    { label: 'Twitter / X', url: profile.twitterUrl, icon: Link2 },
    { label: 'Medium', url: profile.mediumUrl, icon: Link2 },
    { label: 'Behance', url: profile.behanceUrl, icon: Link2 },
    { label: 'Dribbble', url: profile.dribbbleUrl, icon: Link2 },
    { label: 'Research Gate', url: profile.researchGateUrl, icon: Link2 },
  ].filter((l): l is { label: string; url: string; icon: typeof Github } =>
    Boolean(l.url),
  );

  const ctaMessages: Partial<Record<ViewRole, string>> = {
    recruiter:
      'Interested? Download their resume or reach out directly to begin the hiring process.',
    investor:
      'See potential here? Start a conversation — this builder is open to opportunities and collaborators.',
    mentor:
      'Ready to guide their journey? Connect via their preferred platforms or through ProMove.',
    college: 'Review the full application or reach out to the applicant directly.',
    school: 'Contact the student through the listed channels below.',
    student: 'Open to collaborations, peer connections, and new opportunities.',
  };

  return (
    <div>
      <Overline className="mb-3">{meta.overline}</Overline>
      <h2 className="mb-4 text-xl font-light tracking-tight text-zinc-100">{meta.title}</h2>

      {ctaMessages[role] && (
        <p className="mb-8 max-w-prose text-[14px] leading-relaxed text-zinc-500">
          {ctaMessages[role]}
        </p>
      )}

      {socialLinks.length > 0 ? (
        <div className="space-y-4">
          {socialLinks.map(({ label, url, icon: Icon }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <Icon className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-400" />
              <span className="font-medium">{label}</span>
              <span className="max-w-[240px] truncate text-xs text-zinc-700 transition-colors group-hover:text-zinc-500">
                {url}
              </span>
              <ExternalLink className="h-3 w-3 text-zinc-800 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>
      ) : (
        renderMissingSectionState('contact', isOwnProfile, 'No external links added.')
      )}

      {role === 'recruiter' && (
        <div className="mt-10 border-t border-zinc-800/60 pt-8">
          <Overline className="mb-2">Resume</Overline>
          <p className="text-sm text-zinc-600">Resume available on request via ProMove platform.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Identity Hero
// ─────────────────────────────────────────────

function IdentityHero({
  profile,
  role,
  roleConfig,
  isOwnProfile,
}: {
  profile: PublicStudentProfile;
  role: ViewRole;
  roleConfig: RoleDefinition;
  isOwnProfile: boolean;
}) {
  const { displayName, avatar, headline, domain, location, institution } = profile;

  const socialLinksVisible = [
    { label: 'GitHub', url: profile.githubUrl, icon: Github },
    { label: 'LinkedIn', url: profile.linkedinUrl, icon: Linkedin },
    { label: 'Website', url: profile.websiteUrl, icon: Globe },
  ].filter((l): l is { label: string; url: string; icon: typeof Github } => Boolean(l.url));

  const quickStats: Record<ViewRole, { label: string; value: number; sectionId: SectionId }[]> = {
    student: [
      { label: 'Score', value: profile.innovationScore, sectionId: 'achievements' },
      { label: 'Projects', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'Skills', value: profile.skills.length, sectionId: 'skills' },
    ],
    school: [
      { label: 'Projects', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'Skills', value: profile.skills.length, sectionId: 'skills' },
    ],
    college: [
      { label: 'Innovation Score', value: profile.innovationScore, sectionId: 'achievements' },
      { label: 'Projects', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'Certifications', value: profile.certifications.length, sectionId: 'certifications' },
    ],
    mentor: [
      { label: 'Projects', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'Skills', value: profile.skills.length, sectionId: 'skills' },
      { label: '30d Commits', value: profile.githubProof.commitCount30Days, sectionId: 'github' },
    ],
    investor: [
      { label: 'Innovation Score', value: profile.innovationScore, sectionId: 'achievements' },
      { label: 'Projects Shipped', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'GitHub Stars', value: profile.githubStats.totalStars, sectionId: 'github' },
    ],
    recruiter: [
      { label: 'Skills', value: profile.skills.length, sectionId: 'skills' },
      { label: 'Projects', value: profile.portfolioProjects.length, sectionId: 'projects' },
      { label: 'Repos', value: profile.githubStats.totalRepos, sectionId: 'github' },
    ],
  };

  const stats = quickStats[role].filter((stat) => stat.value > 0);
  const primaryCtaLabel = isOwnProfile ? 'Edit Profile' : roleConfig.ctaLabel;

  return (
    <div className="border-b border-zinc-800/70 py-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
        {/* Left: identity */}
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-medium text-zinc-500">
                  {getInitials(displayName)}
                </div>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#09090b] ${roleConfig.accentDot}`}
              title={`Viewing as: ${roleConfig.tag}`}
            />
          </div>

          {/* Name and meta */}
          <div>
            <Overline className="mb-2">{roleConfig.tag}</Overline>
            <h1 className="text-4xl font-light tracking-tight text-zinc-100 lg:text-[52px] lg:leading-none">
              {displayName}
            </h1>
            {(headline || domain) && (
              <p className="mt-3 text-[15px] text-zinc-400">{headline || domain}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-zinc-600">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              )}
              {domain && headline && <span>{domain}</span>}
              {institution && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="h-3 w-3" />
                  {institution.displayName}
                </span>
              )}
              {profile.verifiedAt && (
                <span className="text-emerald-600">Verified</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: stats + social */}
        <div className="flex flex-col items-start gap-5 lg:items-end">
          <div className="flex flex-wrap items-center gap-3">
            {isOwnProfile ? (
              <Link
                to="/dashboard/profile"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
              >
                <PencilLine className="h-4 w-4" />
                {primaryCtaLabel}
              </Link>
            ) : (
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
              >
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>

          {stats.length > 0 ? (
            <div className="flex flex-wrap gap-4 lg:justify-end">
              {stats.map((stat) => (
                <a
                  key={stat.label}
                  href={`#${stat.sectionId}`}
                  className="rounded-2xl border border-zinc-800/70 bg-zinc-950/60 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70 lg:text-right"
                >
                  <p className="text-xl font-light tabular-nums text-zinc-100">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{stat.label}</p>
                </a>
              ))}
            </div>
          ) : null}

          {socialLinksVisible.length > 0 && (
            <div className="flex items-center gap-4">
              {socialLinksVisible.map(({ label, url, icon: Icon }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={label}
                  className="text-zinc-700 transition-colors hover:text-zinc-300"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-700">
        {roleConfig.heroMeta}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Role Switcher
// ─────────────────────────────────────────────

function RoleSwitcher({
  activeRole,
  onRoleChange,
}: {
  activeRole: ViewRole;
  onRoleChange: (role: ViewRole) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="mr-2 text-[10px] uppercase tracking-[0.25em] text-zinc-700">View as</span>
      {VIEW_ROLES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onRoleChange(id)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-all ${
            activeRole === id
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section Nav (desktop sidebar)
// ─────────────────────────────────────────────

function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav className="space-y-0.5">
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className="block rounded py-1.5 text-[13px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function DiscoverabilityMap({
  profile,
  visibleSectionIds,
}: {
  profile: PublicStudentProfile;
  visibleSectionIds: SectionId[];
}) {
  const signals = [
    { id: 'skills', label: 'Skills', count: profile.skills.length, required: true },
    { id: 'projects', label: 'Projects', count: profile.portfolioProjects.length, required: true },
    { id: 'experience', label: 'Experience', count: profile.experience.length, required: true },
    { id: 'academics', label: 'Education', count: profile.education.length, required: true },
    { id: 'certifications', label: 'Certifications', count: profile.certifications.length, required: false },
    { id: 'github', label: 'GitHub', count: profile.githubStats.totalRepos, required: false },
  ].filter((signal) => visibleSectionIds.includes(signal.id as SectionId));

  return (
    <section className="mt-10 rounded-2xl border border-zinc-800/70 bg-zinc-950/60 p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Overline className="mb-2">Discoverability Map</Overline>
          <h2 className="text-lg font-medium text-zinc-100">
            Required signals are marked with <span className="text-sky-300">*</span>
          </h2>
        </div>
        <p className="text-sm text-zinc-500">
          Optional sections still help, but these are the first checks recruiters and mentors scan.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((signal) => (
          <a
            key={signal.id}
            href={`#${signal.id}`}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 transition hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  {signal.label}
                  {signal.required ? <span className="ml-1 text-sky-300">*</span> : null}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {signal.required ? 'Required' : 'Optional'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium text-zinc-100">{signal.count}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  {signal.count > 0 ? 'Ready' : 'Missing'}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Section renderer
// ─────────────────────────────────────────────

function renderSection(
  sectionId: SectionId,
  profile: PublicStudentProfile,
  role: ViewRole,
  roleConfig: RoleDefinition,
  isOwnProfile: boolean,
): React.ReactNode {
  const meta = roleConfig.labels[sectionId];
  if (!meta) return null;

  switch (sectionId) {
    case 'about':
      return <AboutSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'academics':
      return <AcademicsSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'skills':
      return <SkillsSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'projects':
      return <ProjectsSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'experience':
      return <ExperienceSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'certifications':
      return <CertificationsSection profile={profile} meta={meta} isOwnProfile={isOwnProfile} />;
    case 'github':
      return <GitHubSection profile={profile} meta={meta} role={role} isOwnProfile={isOwnProfile} />;
    case 'achievements':
      return <AchievementsSection profile={profile} meta={meta} role={role} />;
    case 'contact':
      return (
        <ContactSection
          profile={profile}
          meta={meta}
          role={role}
          isOwnProfile={isOwnProfile}
        />
      );
    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────

export function PublicStudentProfilePage() {
  const { profileSlug = '' } = useParams();
  const [activeRole, setActiveRole] = useState<ViewRole>('student');
  const authUser = useAuthStore((state) => state.user);

  const profileQuery = useQuery({
    queryKey: ['public-student-profile', profileSlug],
    queryFn: () => userApi.getPublicStudentProfile(profileSlug),
    enabled: profileSlug.trim().length > 0,
  });

  const profile = profileQuery.data;
  const roleConfig = ROLE_DEFINITIONS[activeRole];
  const visibleSections = roleConfig.sectionOrder.filter(
    (id) => !roleConfig.hidden.includes(id),
  );

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <p className="text-sm text-zinc-700">Loading profile…</p>
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-screen bg-[#09090b] px-6 py-24">
        <div className="mx-auto max-w-xl">
          <Overline className="mb-4">Public Profile</Overline>
          <h1 className="text-3xl font-light text-zinc-100">Profile not found</h1>
          <p className="mt-4 text-sm text-zinc-500">
            This profile is either private or the link is invalid.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Return to ProMove →
          </Link>
        </div>
      </div>
    );
  }

  const navSections = visibleSections.map((id) => ({
    id,
    label: roleConfig.labels[id]?.title ?? id,
  }));
  const isOwnProfile = authUser?._id === profile._id;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-[#09090b]/96 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/"
            className="text-xs font-medium text-zinc-700 transition-colors hover:text-zinc-300"
          >
            ProMove
          </Link>
          <RoleSwitcher activeRole={activeRole} onRoleChange={setActiveRole} />
        </div>
      </header>

      {/* Role frame note — contextual hint below header */}
      <div className="border-b border-zinc-800/40 bg-zinc-900/30">
        <div className="mx-auto max-w-5xl px-6 py-2">
          <p className="text-[11px] text-zinc-600">{roleConfig.frameNote}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <IdentityHero
          profile={profile}
          role={activeRole}
          roleConfig={roleConfig}
          isOwnProfile={isOwnProfile}
        />
        <DiscoverabilityMap profile={profile} visibleSectionIds={visibleSections} />

        {/* Body layout */}
        <div className="flex gap-16">
          {/* Sticky sidebar — desktop only */}
          <aside className="hidden w-44 shrink-0 lg:block">
            <div className="sticky top-20 pt-10 pb-24">
              <SectionNav sections={navSections} />
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 pb-24">
            {visibleSections.map((sectionId, index) => (
              <section
                key={`${activeRole}-${sectionId}`}
                id={sectionId}
                className={`py-12 ${index > 0 ? 'border-t border-zinc-800/70' : ''}`}
              >
                {renderSection(sectionId, profile, activeRole, roleConfig, isOwnProfile)}
              </section>
            ))}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6">
          <p className="text-xs text-zinc-700">
            {profile.displayName} · {roleConfig.tag}
          </p>
          <p className="text-xs text-zinc-800">Powered by ProMove</p>
        </div>
      </footer>
    </div>
  );
}
