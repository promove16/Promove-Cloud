process.env.TS_NODE_PREFER_TS_EXTS = 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'node' });
require('ts-node/register/transpile-only');
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('../src/modules/user/user.model');
const { StudentAccessToken } = require('../src/modules/institution/studentAccessToken.model');
const { InstitutionStudentRosterEntry } = require('../src/modules/institution/studentRoster.model');
const { Patent } = require('../src/modules/patent/patent.model');
const { AdminAward } = require('../src/modules/admin/award.model');
const { Startup } = require('../src/modules/startup/startup.model');
const { Deal } = require('../src/modules/deal/deal.model');
const { Event } = require('../src/modules/event/event.model');
const Board = require('../src/models/Board');
const Project = require('../src/models/Project');
const Sprint = require('../src/models/Sprint');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const StudentProfile = require('../src/models/StudentProfile');
const { UserRole } = require('../src/types/roles.types');
const { Workspace } = require('../src/modules/workspace/workspace.model');
const { MentorSession } = require('../src/modules/mentor/mentorSession.model');
const { MentorFeedback } = require('../src/modules/mentor/mentorFeedback.model');
const { Problem } = require('../src/modules/problemBank/problem.model');
const { JobPost } = require('../src/modules/recruiter/jobPost.model');
const { CampusDrive } = require('../src/modules/recruiter/campusDrive.model');

const DEFAULT_PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Admin@ProMove1';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ADMIN_REQUESTED_AT = new Date('2026-03-01T08:00:00.000Z');
const ADMIN_APPROVED_AT = new Date('2026-03-02T08:00:00.000Z');
const VERIFIED_AT = new Date('2026-03-03T09:30:00.000Z');
const PENDING_AT = new Date('2026-03-05T10:15:00.000Z');
const DEMO_TOKENS = { school: 'SCH-DEMO-2026', college: 'COL-DEMO-2026' };
const SEED_DEAL_FUND_TRANSFER_AT = new Date('2026-03-18T10:00:00.000Z');
const SEED_DEAL_APPROVED_AT = new Date('2026-03-21T11:00:00.000Z');
const SEED_DEAL_CLOSED_AT = new Date('2026-03-22T14:30:00.000Z');

const DEFAULT_SCORE_BREAKDOWN = {
  problemsClaimed: 0,
  skillsCompleted: 0,
  progressUploads: 0,
  patentsSubmitted: 0,
  patentsApproved: 0,
  mvpsVerified: 0,
  marketReadyVerified: 0,
  startupsLaunched: 0,
  awardsApproved: 0,
};

const DEFAULT_BOARD_COLUMNS = [
  { id: 'backlog', title: 'Backlog', order: 0 },
  { id: 'todo', title: 'To Do', order: 1 },
  { id: 'in_progress', title: 'In Progress', order: 2 },
  { id: 'review', title: 'Review', order: 3 },
  { id: 'done', title: 'Done', order: 4 },
];

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const createScoreBreakdown = (value) => ({ ...DEFAULT_SCORE_BREAKDOWN, ...(value ?? {}) });

const cloneInstitutionProfile = (profile) =>
  profile
    ? {
        institutionName: profile.institutionName,
        location: profile.location,
        totalStudentsEnrolled: profile.totalStudentsEnrolled,
        academicYear: profile.academicYear,
        iicStarRating: profile.iicStarRating,
        ...(profile.iicLastUpdated ? { iicLastUpdated: new Date(profile.iicLastUpdated) } : {}),
        policies: profile.policies.map((policy) => ({
          name: policy.name,
          status: policy.status,
          ...(policy.lastUpdated ? { lastUpdated: new Date(policy.lastUpdated) } : {}),
        })),
        stats: { ...profile.stats },
      }
    : undefined;

const INSTITUTION_PROFILES = {
  school: {
    institutionName: 'Greenfield High School',
    location: 'Pune, Maharashtra',
    totalStudentsEnrolled: 1240,
    academicYear: '2025-26',
    iicStarRating: 4,
    iicLastUpdated: new Date('2026-02-15T09:00:00.000Z'),
    policies: [
      { name: 'Innovation & Entrepreneurship Policy', status: 'Active', lastUpdated: new Date('2025-08-01') },
      { name: 'Student IP Policy', status: 'On Track', lastUpdated: new Date('2025-06-15') },
      { name: 'Industry Collaboration MoU', status: 'Pending' },
    ],
    stats: { totalInnovationActivities: 38, patentsFiled: 4, totalMentoringHours: 210, startupsLaunched: 3, industryCollaborations: 7 },
  },
  college: {
    institutionName: 'National Institute of Technology, Warangal',
    location: 'Warangal, Telangana',
    totalStudentsEnrolled: 4800,
    academicYear: '2025-26',
    iicStarRating: 5,
    iicLastUpdated: new Date('2026-02-20T09:00:00.000Z'),
    policies: [
      { name: 'Startup & Incubation Policy', status: 'Active', lastUpdated: new Date('2025-07-20') },
      { name: 'Patent Filing Support Policy', status: 'Active', lastUpdated: new Date('2025-05-10') },
      { name: 'Internship Placement Protocol', status: 'Active', lastUpdated: new Date('2025-09-01') },
    ],
    stats: {
      totalInnovationActivities: 112,
      patentsFiled: 27,
      totalMentoringHours: 1450,
      startupsLaunched: 18,
      industryCollaborations: 34,
      totalHRConnections: 186,
      studentsPlaced: 620,
      directShortlistsThisQuarter: 48,
      topHiringSector: 'Software & IT Services',
    },
  },
};

const ADMIN_SEED = {
  key: 'admin',
  role: UserRole.ADMIN,
  email: 'admin@promove.dev',
  displayName: 'ProMove Admin',
  profileSlug: 'seed-admin-promove',
  accessGrantedBy: 'admin',
  bio: 'Platform administrator for verifications, reviews, and system operations.',
  headline: 'Platform Administrator',
  location: 'Remote',
  profileComplete: true,
  registrationStage: 'complete',
  verificationStatus: 'not_required',
  institutionVerificationStatus: 'none',
  adminApprovalStatus: 'not_required',
  isActive: true,
  isProfilePublic: false,
  lastLogin: new Date('2026-03-29T12:00:00.000Z'),
};

const NON_STUDENT_SEEDS = [
  {
    key: 'school',
    role: UserRole.SCHOOL,
    email: 'school@promove.dev',
    displayName: 'Greenfield High School',
    profileSlug: 'seed-school-greenfield-high',
    accessGrantedBy: 'startup_school',
    bio: 'A CBSE-affiliated school in Pune with an active innovation cell and 1,200+ students.',
    headline: 'CBSE School | IIC Level 4 | Pune',
    location: 'Pune, Maharashtra',
    profileComplete: true,
    registrationStage: 'complete',
    verificationStatus: 'not_required',
    institutionVerificationStatus: 'verified',
    adminApprovalStatus: 'approved',
    adminApprovalRequestedAt: ADMIN_REQUESTED_AT,
    institutionProfile: INSTITUTION_PROFILES.school,
    isActive: true,
    lastLogin: new Date('2026-03-29T07:10:00.000Z'),
  },
  {
    key: 'college',
    role: UserRole.COLLEGE,
    email: 'college@promove.dev',
    displayName: 'National Institute of Technology, Warangal',
    profileSlug: 'seed-college-nit-warangal',
    accessGrantedBy: 'admin',
    bio: 'Premier engineering institution known for research, innovation, and placement excellence.',
    headline: 'NIT Warangal | Innovation Hub',
    location: 'Warangal, Telangana',
    profileComplete: true,
    registrationStage: 'complete',
    verificationStatus: 'not_required',
    institutionVerificationStatus: 'verified',
    adminApprovalStatus: 'approved',
    adminApprovalRequestedAt: ADMIN_REQUESTED_AT,
    institutionProfile: INSTITUTION_PROFILES.college,
    isActive: true,
    lastLogin: new Date('2026-03-29T08:20:00.000Z'),
  },
  {
    key: 'mentor',
    role: UserRole.MENTOR,
    email: 'mentor@promove.dev',
    displayName: 'Dr. Aisha Menon',
    profileSlug: 'seed-mentor-aisha-menon',
    accessGrantedBy: 'admin',
    bio: 'IIT Madras alumna and deep-tech mentor for student founders.',
    headline: 'Product Strategist | Deep-Tech Mentor | IIT Madras',
    location: 'Bangalore, Karnataka',
    domain: 'Product Strategy & Deep Tech',
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'not_required',
    institutionVerificationStatus: 'none',
    adminApprovalStatus: 'approved',
    adminApprovalRequestedAt: ADMIN_REQUESTED_AT,
    isActive: true,
  },
  {
    key: 'investor',
    role: UserRole.INVESTOR,
    email: 'investor@promove.dev',
    displayName: 'Vikram Kapoor',
    profileSlug: 'seed-investor-vikram-kapoor',
    accessGrantedBy: 'admin',
    bio: 'Angel investor focused on EdTech, AgriTech, and B2B SaaS.',
    headline: 'Angel Investor | Surge Ventures',
    location: 'Mumbai, Maharashtra',
    domain: 'EdTech, AgriTech, B2B SaaS',
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'not_required',
    institutionVerificationStatus: 'none',
    adminApprovalStatus: 'approved',
    adminApprovalRequestedAt: ADMIN_REQUESTED_AT,
    isActive: true,
  },
  {
    key: 'recruiter',
    role: UserRole.RECRUITER,
    email: 'recruiter@promove.dev',
    displayName: 'Tanisha Mehta',
    profileSlug: 'seed-recruiter-tanisha-mehta',
    accessGrantedBy: 'admin',
    bio: 'Senior tech talent lead focused on student innovators.',
    headline: 'Tech Talent Acquisition | InnovateSoft',
    location: 'Hyderabad, Telangana',
    domain: 'Technology Recruitment',
    profileComplete: true,
    registrationStage: 'profile_setup',
    verificationStatus: 'not_required',
    institutionVerificationStatus: 'none',
    adminApprovalStatus: 'approved',
    adminApprovalRequestedAt: ADMIN_REQUESTED_AT,
    isActive: true,
  },
];

const STUDENT_SEEDS = [
  {
    key: 'arjun',
    role: UserRole.STUDENT,
    email: 'arjun.sharma@student.promove.dev',
    displayName: 'Arjun Sharma',
    profileSlug: 'seed-student-arjun-sharma',
    accessGrantedBy: 'institution_roster',
    institutionKey: 'college',
    institutionToken: DEMO_TOKENS.college,
    bio: 'Final year CSE student passionate about AI/ML and product development.',
    headline: 'Full Stack Developer | AI Enthusiast',
    location: 'Warangal, Telangana',
    domain: 'Artificial Intelligence',
    innovationScore: 360,
    scoreBreakdown: { problemsClaimed: 2, skillsCompleted: 5, progressUploads: 8, patentsSubmitted: 2, patentsApproved: 1, mvpsVerified: 1, startupsLaunched: 1, awardsApproved: 3 },
    profileComplete: true,
    registrationStage: 'complete',
    verificationStatus: 'verified',
    institutionVerificationStatus: 'verified',
    isActive: true,
    discoverableToRecruiters: true,
    skills: [
      { name: 'TypeScript', category: 'programming', source: 'manual', level: 'advanced', endorsements: 16 },
      { name: 'Machine Learning', category: 'research', source: 'manual', level: 'intermediate', endorsements: 9 },
    ],
    verificationRequestedAt: VERIFIED_AT,
    verifiedAt: VERIFIED_AT,
    institutionVerifiedAt: VERIFIED_AT,
    lastLogin: new Date('2026-03-29T09:10:00.000Z'),
  },
  {
    key: 'priya',
    role: UserRole.STUDENT,
    email: 'priya.nair@student.promove.dev',
    displayName: 'Priya Nair',
    profileSlug: 'seed-student-priya-nair',
    accessGrantedBy: 'institution_roster',
    institutionKey: 'college',
    institutionToken: DEMO_TOKENS.college,
    bio: 'B.Tech Electronics student exploring IoT and embedded systems for agriculture.',
    headline: 'IoT Developer | AgriTech Innovator',
    location: 'Warangal, Telangana',
    domain: 'Internet of Things',
    innovationScore: 245,
    scoreBreakdown: { problemsClaimed: 1, skillsCompleted: 4, progressUploads: 5, patentsSubmitted: 2, patentsApproved: 1, mvpsVerified: 1, startupsLaunched: 1, awardsApproved: 2 },
    profileComplete: true,
    registrationStage: 'complete',
    verificationStatus: 'verified',
    institutionVerificationStatus: 'verified',
    isActive: true,
    discoverableToRecruiters: true,
    skills: [
      { name: 'Embedded Systems', category: 'programming', source: 'manual', level: 'advanced', endorsements: 12 },
      { name: 'IoT Prototyping', category: 'research', source: 'manual', level: 'advanced', endorsements: 11 },
    ],
    verificationRequestedAt: VERIFIED_AT,
    verifiedAt: VERIFIED_AT,
    institutionVerifiedAt: VERIFIED_AT,
    lastLogin: new Date('2026-03-28T18:40:00.000Z'),
  },
  {
    key: 'rohit',
    role: UserRole.STUDENT,
    email: 'rohit.patel@student.promove.dev',
    displayName: 'Rohit Patel',
    profileSlug: 'seed-student-rohit-patel',
    accessGrantedBy: 'institution_roster',
    institutionKey: 'school',
    institutionToken: DEMO_TOKENS.school,
    bio: 'Class 12 student interested in sustainable energy and renewable tech.',
    headline: 'Young Renewable Energy Builder',
    location: 'Pune, Maharashtra',
    domain: 'Renewable Energy',
    innovationScore: 125,
    scoreBreakdown: { problemsClaimed: 1, skillsCompleted: 2, progressUploads: 3, patentsSubmitted: 1, startupsLaunched: 1, awardsApproved: 1 },
    profileComplete: false,
    registrationStage: 'institution_verified',
    verificationStatus: 'verified',
    institutionVerificationStatus: 'verified',
    isActive: true,
    verificationRequestedAt: VERIFIED_AT,
    verifiedAt: VERIFIED_AT,
    institutionVerifiedAt: VERIFIED_AT,
  },
  {
    key: 'neha',
    role: UserRole.STUDENT,
    email: 'neha.verma@student.promove.dev',
    displayName: 'Neha Verma',
    profileSlug: 'seed-student-neha-verma',
    accessGrantedBy: 'institution_roster',
    institutionKey: 'school',
    institutionToken: DEMO_TOKENS.school,
    bio: 'Class 11 student exploring robotics for smart classrooms.',
    headline: 'School Robotics Explorer',
    location: 'Pune, Maharashtra',
    domain: 'Educational Robotics',
    innovationScore: 40,
    scoreBreakdown: { skillsCompleted: 1, progressUploads: 1 },
    profileComplete: false,
    registrationStage: 'institution_pending',
    verificationStatus: 'pending',
    institutionVerificationStatus: 'verified',
    isActive: false,
    verificationRequestedAt: PENDING_AT,
    institutionVerifiedAt: PENDING_AT,
  },
];

const ROSTER_SEEDS = [
  { institutionKey: 'college', studentKey: 'arjun', displayName: 'Arjun Sharma', email: 'arjun.sharma@student.promove.dev', gradeOrProgram: 'B.Tech CSE 2026', rollNumber: 'NITW-CSE-22-041', status: 'verified', registeredAt: VERIFIED_AT, reviewedAt: VERIFIED_AT },
  { institutionKey: 'college', studentKey: 'priya', displayName: 'Priya Nair', email: 'priya.nair@student.promove.dev', gradeOrProgram: 'B.Tech ECE 2026', rollNumber: 'NITW-ECE-22-016', status: 'verified', registeredAt: VERIFIED_AT, reviewedAt: VERIFIED_AT },
  { institutionKey: 'school', studentKey: 'rohit', displayName: 'Rohit Patel', email: 'rohit.patel@student.promove.dev', gradeOrProgram: 'Class 12', rollNumber: 'GFHS-12-103', status: 'verified', registeredAt: VERIFIED_AT, reviewedAt: VERIFIED_AT },
  { institutionKey: 'school', studentKey: 'neha', displayName: 'Neha Verma', email: 'neha.verma@student.promove.dev', gradeOrProgram: 'Class 11', rollNumber: 'GFHS-11-087', status: 'registered_pending', registeredAt: PENDING_AT },
];

const STUDENT_PROFILE_SEEDS = [
  {
    studentKey: 'arjun',
    institutionKey: 'college',
    mentorKey: 'mentor',
    leaderboardScore: 360,
    bio: 'Builder focused on production-grade AI products for agriculture and social impact.',
    skills: ['TypeScript', 'Machine Learning', 'Product Thinking'],
    edtechCourses: ['Applied ML Systems', 'Startup Finance Basics'],
    githubUrl: 'https://github.com/arjun-sharma',
    linkedinUrl: 'https://linkedin.com/in/arjun-sharma',
  },
  {
    studentKey: 'priya',
    institutionKey: 'college',
    mentorKey: 'mentor',
    leaderboardScore: 245,
    bio: 'IoT and embedded systems enthusiast building resilient farm automation tools.',
    skills: ['Embedded Systems', 'IoT Prototyping', 'PCB Debugging'],
    edtechCourses: ['Embedded Linux', 'Sensors for Field Networks'],
    githubUrl: 'https://github.com/priyanair-dev',
    linkedinUrl: 'https://linkedin.com/in/priya-nair-dev',
  },
  {
    studentKey: 'rohit',
    institutionKey: 'school',
    mentorKey: 'mentor',
    leaderboardScore: 125,
    bio: 'Student innovator experimenting with renewable-energy kits and energy data visualisation.',
    skills: ['Energy Modeling', 'Rapid Prototyping'],
    edtechCourses: ['Solar Basics', 'Intro to Product Validation'],
    githubUrl: 'https://github.com/rohit-patel-labs',
    linkedinUrl: 'https://linkedin.com/in/rohit-patel-labs',
  },
  {
    studentKey: 'neha',
    institutionKey: 'school',
    mentorKey: 'mentor',
    leaderboardScore: 40,
    bio: 'Early-stage robotics learner building curiosity through maker projects.',
    skills: ['Arduino Basics', 'Robotics'],
    edtechCourses: ['Getting Started with Sensors'],
    githubUrl: 'https://github.com/neha-verma-maker',
    linkedinUrl: 'https://linkedin.com/in/neha-verma-maker',
  },
];

const PROJECT_SEEDS = [
  {
    key: 'agrisense-platform',
    slug: 'agrisense-platform',
    title: 'AgriSense Field Intelligence',
    description: 'A farmer-facing decision support platform that combines edge vision diagnostics with advisory workflows.',
    leadStudentKey: 'arjun',
    mentorKey: 'mentor',
    investorKey: 'investor',
    institutionKey: 'college',
    status: 'active',
    boardName: 'AgriSense Delivery Board',
    tags: ['AI', 'AgriTech', 'Diagnostics'],
    techStack: ['TypeScript', 'Node.js', 'TensorFlow Lite'],
    isPublic: true,
    marketplaceListing: {
      price: 300000,
      status: 'listed',
      description: 'Pilot-ready agritech intelligence stack for institutional and incubation programs.',
    },
    pitchRequests: [{ investorKey: 'investor', status: 'accepted', feedback: 'Proceed to diligence for a controlled pilot.', meetingId: null }],
  },
  {
    key: 'soilmesh-network',
    slug: 'soilmesh-network',
    title: 'SoilMesh Monitoring Network',
    description: 'A modular sensor mesh for irrigation insights and low-maintenance field telemetry.',
    leadStudentKey: 'priya',
    mentorKey: 'mentor',
    investorKey: 'investor',
    institutionKey: 'college',
    status: 'active',
    boardName: 'SoilMesh Hardware Board',
    tags: ['IoT', 'Sensors', 'AgriTech'],
    techStack: ['C++', 'ESP32', 'MQTT'],
    isPublic: true,
    marketplaceListing: {
      price: 180000,
      status: 'listed',
      description: 'Sensor network kit with deployment support for pilot farms and labs.',
    },
    pitchRequests: [{ investorKey: 'investor', status: 'under_review', feedback: 'Need 30-day uptime metrics before closing.', meetingId: null }],
  },
  {
    key: 'renewgrid-junior',
    slug: 'renewgrid-junior',
    title: 'RenewGrid Junior Analytics',
    description: 'A school-led toolkit to model solar output, battery planning, and classroom energy experiments.',
    leadStudentKey: 'rohit',
    mentorKey: 'mentor',
    status: 'planning',
    boardName: 'RenewGrid Student Board',
    tags: ['Renewable Energy', 'Education', 'Analytics'],
    techStack: ['JavaScript', 'Charts', 'Arduino'],
    isPublic: false,
    marketplaceListing: {
      price: 0,
      status: 'not_listed',
      description: '',
    },
    pitchRequests: [],
  },
];

const TEAM_SEEDS = [
  {
    key: 'agrisense-team',
    name: 'AgriSense Core Team',
    projectKey: 'agrisense-platform',
    leadKey: 'arjun',
    members: [
      { userKey: 'arjun', role: 'lead', joinedAt: new Date('2026-02-05T09:00:00.000Z') },
      { userKey: 'neha', role: 'designer', joinedAt: new Date('2026-02-12T09:00:00.000Z') },
    ],
  },
  {
    key: 'soilmesh-team',
    name: 'SoilMesh Guild',
    projectKey: 'soilmesh-network',
    leadKey: 'priya',
    members: [
      { userKey: 'priya', role: 'lead', joinedAt: new Date('2026-02-10T09:00:00.000Z') },
      { userKey: 'rohit', role: 'tester', joinedAt: new Date('2026-02-18T09:00:00.000Z') },
    ],
  },
];

const SPRINT_SEEDS = [
  {
    key: 'agrisense-sprint-1',
    projectKey: 'agrisense-platform',
    name: 'Field Pilot Sprint',
    goal: 'Ship the first stable offline diagnostics flow for pilot farms.',
    startDate: new Date('2026-02-01T00:00:00.000Z'),
    endDate: new Date('2026-02-14T00:00:00.000Z'),
    status: 'completed',
  },
  {
    key: 'agrisense-sprint-2',
    projectKey: 'agrisense-platform',
    name: 'Pilot Expansion Sprint',
    goal: 'Improve issue resolution and advisor workflow coverage.',
    startDate: new Date('2026-02-15T00:00:00.000Z'),
    endDate: new Date('2026-02-28T00:00:00.000Z'),
    status: 'active',
  },
  {
    key: 'soilmesh-sprint-1',
    projectKey: 'soilmesh-network',
    name: 'Sensor Calibration Sprint',
    goal: 'Validate moisture and pH sensor consistency in lab conditions.',
    startDate: new Date('2026-02-03T00:00:00.000Z'),
    endDate: new Date('2026-02-16T00:00:00.000Z'),
    status: 'completed',
  },
  {
    key: 'soilmesh-sprint-2',
    projectKey: 'soilmesh-network',
    name: 'Mesh Stability Sprint',
    goal: 'Improve packet resilience and dashboard alerting.',
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-03-14T00:00:00.000Z'),
    status: 'planned',
  },
  {
    key: 'renewgrid-sprint-1',
    projectKey: 'renewgrid-junior',
    name: 'Prototype Bench Sprint',
    goal: 'Prepare classroom-ready demo kits and baseline dashboards.',
    startDate: new Date('2026-03-05T00:00:00.000Z'),
    endDate: new Date('2026-03-20T00:00:00.000Z'),
    status: 'active',
  },
];

const TICKET_SEEDS = [
  {
    projectKey: 'agrisense-platform',
    sprintKey: 'agrisense-sprint-1',
    title: 'Build offline image inference pipeline',
    description: 'Package the disease classifier for edge execution with fallback handling.',
    status: 'done',
    priority: 'P0',
    assigneeKey: 'arjun',
    reporterKey: 'arjun',
    labels: ['ml', 'edge'],
    storyPoints: 8,
    dueDate: new Date('2026-02-09T00:00:00.000Z'),
    order: 0,
    comments: [{ authorKey: 'mentor', body: 'Keep the deployment bundle under the field-device memory budget.', createdAt: new Date('2026-02-04T12:00:00.000Z') }],
  },
  {
    projectKey: 'agrisense-platform',
    sprintKey: 'agrisense-sprint-2',
    title: 'Design advisor escalation dashboard',
    description: 'Create a concise dashboard for agronomists to review field alerts and crop recommendations.',
    status: 'review',
    priority: 'P1',
    assigneeKey: 'neha',
    reporterKey: 'arjun',
    labels: ['ui', 'dashboard'],
    storyPoints: 5,
    dueDate: new Date('2026-02-24T00:00:00.000Z'),
    order: 1,
    comments: [{ authorKey: 'arjun', body: 'Use card summaries for quick triage during pilot calls.', createdAt: new Date('2026-02-20T12:00:00.000Z') }],
  },
  {
    projectKey: 'agrisense-platform',
    sprintKey: 'agrisense-sprint-2',
    title: 'Add multilingual treatment prompts',
    description: 'Support farmer-friendly guidance in English, Hindi, and Telugu.',
    status: 'todo',
    priority: 'P2',
    assigneeKey: 'arjun',
    reporterKey: 'mentor',
    labels: ['localization'],
    storyPoints: 3,
    dueDate: new Date('2026-02-27T00:00:00.000Z'),
    order: 2,
    comments: [],
  },
  {
    projectKey: 'soilmesh-network',
    sprintKey: 'soilmesh-sprint-1',
    title: 'Validate soil sensor drift',
    description: 'Benchmark sensor outputs against calibrated reference readings.',
    status: 'done',
    priority: 'P1',
    assigneeKey: 'priya',
    reporterKey: 'priya',
    labels: ['hardware', 'qa'],
    storyPoints: 5,
    dueDate: new Date('2026-02-12T00:00:00.000Z'),
    order: 0,
    comments: [{ authorKey: 'mentor', body: 'Capture both dry and wet calibration curves for the final report.', createdAt: new Date('2026-02-08T12:00:00.000Z') }],
  },
  {
    projectKey: 'soilmesh-network',
    sprintKey: 'soilmesh-sprint-2',
    title: 'Improve gateway packet retries',
    description: 'Reduce data loss during intermittent connectivity conditions.',
    status: 'in_progress',
    priority: 'P1',
    assigneeKey: 'rohit',
    reporterKey: 'priya',
    labels: ['networking', 'firmware'],
    storyPoints: 8,
    dueDate: new Date('2026-03-10T00:00:00.000Z'),
    order: 1,
    comments: [{ authorKey: 'priya', body: 'Please log retry counts during the greenhouse run.', createdAt: new Date('2026-03-04T12:00:00.000Z') }],
  },
  {
    projectKey: 'soilmesh-network',
    sprintKey: 'soilmesh-sprint-2',
    title: 'Add low-battery alert thresholds',
    description: 'Show pre-emptive battery warnings before nodes go offline.',
    status: 'backlog',
    priority: 'P2',
    assigneeKey: 'priya',
    reporterKey: 'mentor',
    labels: ['telemetry'],
    storyPoints: 3,
    dueDate: new Date('2026-03-12T00:00:00.000Z'),
    order: 2,
    comments: [],
  },
  {
    projectKey: 'renewgrid-junior',
    sprintKey: 'renewgrid-sprint-1',
    title: 'Prototype classroom solar monitor',
    description: 'Assemble the first classroom demo kit with live solar output charts.',
    status: 'in_progress',
    priority: 'P1',
    assigneeKey: 'rohit',
    reporterKey: 'rohit',
    labels: ['prototype', 'energy'],
    storyPoints: 5,
    dueDate: new Date('2026-03-15T00:00:00.000Z'),
    order: 0,
    comments: [{ authorKey: 'mentor', body: 'Keep the casing safe for repeated classroom handling.', createdAt: new Date('2026-03-08T12:00:00.000Z') }],
  },
  {
    projectKey: 'renewgrid-junior',
    sprintKey: 'renewgrid-sprint-1',
    title: 'Draft student-friendly demo script',
    description: 'Prepare a simple explanation flow for presenting the energy model to peers.',
    status: 'todo',
    priority: 'P3',
    assigneeKey: 'rohit',
    reporterKey: 'mentor',
    labels: ['education', 'presentation'],
    storyPoints: 2,
    dueDate: new Date('2026-03-18T00:00:00.000Z'),
    order: 1,
    comments: [],
  },
];

const EVENT_SEEDS = [
  {
    institutionKey: 'college',
    createdByKey: 'college',
    title: 'Innovation Drive: Smart Systems Demo Day',
    type: 'Innovation Drive',
    description: 'Campus-wide showcase for student teams shipping prototypes in AI, IoT, and automation.',
    scheduledAt: new Date('2026-04-04T10:00:00.000Z'),
    participants: [
      { studentKey: 'arjun', submissionScore: 91, joinedAt: new Date('2026-03-20T10:00:00.000Z') },
      { studentKey: 'priya', submissionScore: 87, joinedAt: new Date('2026-03-21T10:00:00.000Z') },
    ],
    rankings: [
      { rank: 1, studentKey: 'arjun', compositeScore: 94, innovationScore: 360, submissionScore: 91 },
      { rank: 2, studentKey: 'priya', compositeScore: 90, innovationScore: 245, submissionScore: 87 },
    ],
    rankingsComputedAt: new Date('2026-04-04T16:00:00.000Z'),
  },
  {
    institutionKey: 'college',
    createdByKey: 'college',
    title: 'Placement Hackathon: Product Build Weekend',
    type: 'Placement Hackathon',
    description: 'Recruiter-facing sprint to evaluate product thinking, delivery, and pitching.',
    scheduledAt: new Date('2026-04-12T09:00:00.000Z'),
    participants: [
      { studentKey: 'arjun', submissionScore: 89, joinedAt: new Date('2026-03-25T10:00:00.000Z') },
      { studentKey: 'priya', submissionScore: 84, joinedAt: new Date('2026-03-26T10:00:00.000Z') },
    ],
    rankings: [],
  },
  {
    institutionKey: 'school',
    createdByKey: 'school',
    title: 'Industry Connect: Renewable Futures',
    type: 'Industry Connect Session',
    description: 'A school industry session on clean energy experimentation and project storytelling.',
    scheduledAt: new Date('2026-04-08T11:00:00.000Z'),
    participants: [{ studentKey: 'rohit', joinedAt: new Date('2026-03-28T10:00:00.000Z') }],
    rankings: [],
  },
  {
    institutionKey: 'school',
    createdByKey: 'school',
    title: 'Innovation Drive: Robotics and Energy Showcase',
    type: 'Innovation Drive',
    description: 'Students present early-stage robotics and sustainability builds to mentors and parents.',
    scheduledAt: new Date('2026-04-19T10:30:00.000Z'),
    participants: [
      { studentKey: 'rohit', submissionScore: 76, joinedAt: new Date('2026-03-30T10:00:00.000Z') },
      { studentKey: 'neha', submissionScore: 68, joinedAt: new Date('2026-03-30T10:30:00.000Z') },
    ],
    rankings: [
      { rank: 1, studentKey: 'rohit', compositeScore: 81, innovationScore: 125, submissionScore: 76 },
      { rank: 2, studentKey: 'neha', compositeScore: 71, innovationScore: 40, submissionScore: 68 },
    ],
    rankingsComputedAt: new Date('2026-04-19T15:30:00.000Z'),
  },
];

const STARTUP_SEEDS = [
  {
    key: 'agrisense',
    founderKey: 'arjun',
    name: 'AgriSense AI',
    tagline: 'AI crop diagnostics for small and mid-sized farms.',
    category: 'AgriTech',
    stage: 'Launched',
    pitchDeckUrl: 'https://example.com/pitch/agrisense-ai',
    teamSize: 3,
    fundingNeeded: 1200000,
    activeProducts: 1,
    launchedToInvestors: true,
    launchedToMentors: true,
    launchedToRecruiters: true,
    launchedAt: new Date('2026-03-12T09:00:00.000Z'),
    innovationScoreAtLaunch: 320,
    totalShares: 1000,
    availableShares: 755,
    reservedForSole: 510,
    maxPennyInvestors: 50,
    currentPennyCount: 0,
    hasSoleInvestor: true,
    soleInvestorKey: 'investor',
    traction: {
      patentFiled: true,
      mvpBuilt: true,
      revenueGenerating: true,
      usersCount: 480,
    },
    isActive: true,
  },
  {
    key: 'soilmesh',
    founderKey: 'priya',
    name: 'SoilMesh Systems',
    tagline: 'Resilient sensor networks for irrigation visibility.',
    category: 'AgriTech',
    stage: 'Pre-Launch',
    pitchDeckUrl: 'https://example.com/pitch/soilmesh-systems',
    teamSize: 2,
    fundingNeeded: 650000,
    activeProducts: 1,
    launchedToInvestors: true,
    launchedToMentors: true,
    launchedToRecruiters: false,
    launchedAt: new Date('2026-03-15T09:00:00.000Z'),
    innovationScoreAtLaunch: 230,
    totalShares: 1000,
    availableShares: 965,
    reservedForSole: 510,
    maxPennyInvestors: 50,
    currentPennyCount: 1,
    hasSoleInvestor: false,
    traction: {
      patentFiled: true,
      mvpBuilt: true,
      revenueGenerating: false,
      usersCount: 120,
    },
    isActive: true,
  },
  {
    key: 'solarnest',
    founderKey: 'rohit',
    name: 'SolarNest Junior',
    tagline: 'A school-built solar analytics kit for energy learning.',
    category: 'CleanTech',
    stage: 'MVP',
    pitchDeckUrl: 'https://example.com/pitch/solarnest-junior',
    teamSize: 1,
    fundingNeeded: 180000,
    activeProducts: 1,
    launchedToInvestors: true,
    launchedToMentors: true,
    launchedToRecruiters: false,
    launchedAt: new Date('2026-03-18T09:00:00.000Z'),
    innovationScoreAtLaunch: 110,
    totalShares: 1000,
    availableShares: 980,
    reservedForSole: 510,
    maxPennyInvestors: 50,
    currentPennyCount: 1,
    hasSoleInvestor: false,
    traction: {
      patentFiled: false,
      mvpBuilt: true,
      revenueGenerating: false,
      usersCount: 28,
    },
    isActive: true,
  },
];

const PATENT_SEEDS = [
  {
    studentKey: 'arjun',
    workspaceKey: 'arjun_agrisense',
    projectTitle: 'AgriSense Edge Disease Detection Kit',
    questionnaire: {
      whatIsYourInnovation: 'An edge-AI kit that detects early crop disease from leaf images without depending on continuous internet access.',
      noveltyExplanation: 'The solution combines lightweight vision inference, offline advisory prompts, and localized treatment suggestions for low-connectivity farms.',
      technicalDetails: 'The device uses an on-device CNN model, Raspberry Pi compute, and a mobile dashboard for agronomists to track field health.',
      marketUseCase: 'Farmer producer organizations and agri-input partners can use it to reduce crop loss and improve treatment turnaround times.',
      priorArtAwareness: 'Reviewed public agri-vision tools and positioned the novelty around offline deployment and advisory localization.',
    },
    filingDocuments: {
      inventionCategory: 'iot_hardware_interface',
      specificationType: 'complete',
      inventorJournalSummary: 'Documented 6 months of field prototype testing across 3 farm clusters in Telangana. Logs include sensor accuracy measurements, network reliability in low-signal zones, and farmer feedback on advisory UI.',
      priorArtSearchSummary: 'Reviewed Google Patents and existing agri-vision tools. No existing solution combines offline-first CNN inference with localized advisory prompts on an embedded device at this price point.',
      prototypeStatus: 'validated_prototype',
      specificationDraft: 'The invention relates to an embedded edge-AI device for early-stage crop disease detection. The device integrates a camera module, on-device inference engine, and a mobile advisory interface capable of operating in zero-connectivity environments.',
      abstractDraft: 'An IoT-enabled crop disease detection kit that performs real-time leaf analysis using on-device machine learning, without requiring internet connectivity, and delivers localized treatment recommendations via a companion mobile application.',
      claimsDraft: '1. A portable device for crop disease detection comprising an embedded camera, an offline CNN inference module, and a mobile dashboard. 2. The device as in claim 1, wherein the inference model is updated via batch sync when connectivity is available.',
      drawingsPrepared: true,
      drawingsNotes: 'Five technical drawings prepared: system block diagram, hardware assembly layout, mobile app wireframes, data flow diagram, and field deployment topology.',
      form1ApplicantDetailsConfirmed: true,
      form5InventorshipConfirmed: true,
      form26PowerOfAttorneyRequired: false,
      examinationRequestPlan: 'Requesting examination within 48 months from the filing date. Inventor will self-represent at provisional stage and engage a registered patent agent for complete specification.',
      publicDisclosureChecked: true,
      professionalSupportNeeded: false,
      costManagementNotes: 'Filing fees estimated under INR 4,000 for educational institution category. No agent fees at provisional stage.',
    },
    supportingDocuments: [
      {
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/agrisense_spec_draft.pdf',
        fileType: 'pdf',
        fileName: 'AgriSense_Specification_Draft.pdf',
        fileSizeBytes: 245760,
        note: 'Complete specification draft including claims, abstract, and drawings reference.',
      },
    ],
    status: 'approved',
    submittedAt: new Date('2026-02-18T10:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-04T09:00:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'priya',
    workspaceKey: 'priya_soilmesh',
    projectTitle: 'Mesh-Based Soil Monitoring Node',
    questionnaire: {
      whatIsYourInnovation: 'A low-cost IoT node network that measures moisture, pH, and ambient conditions across distributed plots.',
      noveltyExplanation: 'The system focuses on modular sensor replacement and mesh resilience for farms that cannot maintain gateway-heavy setups.',
      technicalDetails: 'It uses ESP32-based boards, solar trickle charging, and a mesh communication layer with a lightweight farmer app.',
      marketUseCase: 'Suitable for precision irrigation pilots in educational institutions and small agricultural research programs.',
      priorArtAwareness: 'Benchmarked existing precision irrigation devices and differentiated on modularity, repairability, and mesh-first design.',
    },
    filingDocuments: {
      inventionCategory: 'iot_hardware_interface',
      specificationType: 'provisional',
      inventorJournalSummary: 'Lab journal entries from September 2025 to February 2026 documenting sensor calibration trials, mesh routing experiments, and battery performance under partial shade conditions.',
      priorArtSearchSummary: 'Searched public filings and academic literature. Identified 3 relevant patents in the precision agriculture space but none with modular mesh-node architecture targeting sub-1-acre plot monitoring.',
      prototypeStatus: 'working_prototype',
      specificationDraft: 'The invention relates to a mesh-networked soil monitoring system comprising low-power sensor nodes capable of measuring soil moisture, temperature, and pH, communicating via a self-healing mesh protocol.',
      abstractDraft: 'A modular, solar-powered IoT node system for distributed soil monitoring that uses mesh networking to relay field data without a central gateway, enabling resilient monitoring in low-infrastructure farm environments.',
      claimsDraft: '1. A soil monitoring node comprising a moisture sensor, pH probe, temperature sensor, and a mesh radio transceiver. 2. A network of nodes as in claim 1, configured to route data through adjacent nodes when a direct uplink is unavailable.',
      drawingsPrepared: true,
      drawingsNotes: 'Three drawings ready: node PCB layout, mesh topology diagram, and mobile dashboard wireframes. Technical illustrations to be finalized before complete specification.',
      form1ApplicantDetailsConfirmed: true,
      form5InventorshipConfirmed: true,
      form26PowerOfAttorneyRequired: false,
      examinationRequestPlan: 'Will convert provisional to complete specification within 12 months. Examination request to be filed with complete specification filing.',
      publicDisclosureChecked: false,
      professionalSupportNeeded: true,
      costManagementNotes: 'Seeking guidance on institution-subsidized filing. Mentor advised exploring TIFAC student patent scheme.',
    },
    supportingDocuments: [],
    status: 'under_review',
    submittedAt: new Date('2026-03-08T11:30:00.000Z'),
    scoreAwarded: false,
  },
  {
    studentKey: 'arjun',
    workspaceKey: 'arjun_agrisense',
    projectTitle: 'Localized Crop Recovery Recommendation Engine',
    questionnaire: {
      whatIsYourInnovation: 'A recommendation engine that maps detected crop conditions to localized recovery workflows.',
      noveltyExplanation: 'It links field condition signals with region-specific remediation advice and input availability constraints.',
      technicalDetails: 'The system combines crop metadata, disease confidence scores, and treatment catalogs into a recommendation workflow.',
      marketUseCase: 'Useful for agri advisors, FPOs, and rural incubation programs running crop support pilots.',
      priorArtAwareness: 'Compared existing advisory engines and focused novelty on localized remediation logic tied to edge diagnostics.',
    },
    filingDocuments: {
      inventionCategory: 'software_hardware_integration',
      specificationType: 'provisional',
      inventorJournalSummary: 'Research journal from October 2025 to March 2026. Includes treatment catalog design, regional input availability mapping logic, and workflow testing across 2 states.',
      priorArtSearchSummary: 'Reviewed public agri-advisory tools. Differentiation is in the tight coupling between edge-derived disease confidence scores and localized remediation paths based on region-specific input availability.',
      prototypeStatus: 'partial_prototype',
      specificationDraft: 'The invention relates to a software system for generating localized crop recovery recommendations by integrating disease detection outputs with region-specific treatment availability data.',
      abstractDraft: 'A crop recovery recommendation engine that processes edge-generated disease confidence scores and maps them to actionable, location-specific remediation workflows, accounting for input availability and advisor capacity.',
      claimsDraft: '1. A method for generating crop recovery recommendations comprising receiving a disease classification output, querying a regional treatment catalog, and returning a ranked remediation workflow. 2. The method as in claim 1, wherein the catalog is updated from a central server via periodic sync.',
      drawingsPrepared: false,
      drawingsNotes: 'System architecture diagrams in progress. Workflow flowcharts to be prepared once the recommendation API is stabilized.',
      form1ApplicantDetailsConfirmed: true,
      form5InventorshipConfirmed: true,
      form26PowerOfAttorneyRequired: false,
      examinationRequestPlan: 'Provisional filing to establish priority date. Complete specification to follow within 12 months pending software finalization.',
      publicDisclosureChecked: true,
      professionalSupportNeeded: false,
    },
    supportingDocuments: [],
    status: 'submitted',
    submittedAt: new Date('2026-03-14T09:20:00.000Z'),
    scoreAwarded: false,
  },
  {
    studentKey: 'priya',
    workspaceKey: 'priya_soilmesh',
    projectTitle: 'Adaptive Valve Controller for Shared Irrigation Lines',
    questionnaire: {
      whatIsYourInnovation: 'A controller that balances irrigation timings across shared pipeline constraints in small farm clusters.',
      noveltyExplanation: 'The logic prioritizes water efficiency and fairness across low-resource irrigation schedules.',
      technicalDetails: 'It combines relay control, time-window balancing, and telemetry-based usage estimates.',
      marketUseCase: 'Designed for community irrigation pilots and campus agri research plots.',
      priorArtAwareness: 'Reviewed smart valve products and differentiated on shared-line coordination for clustered small farms.',
    },
    filingDocuments: {
      inventionCategory: 'iot_hardware_interface',
      specificationType: 'complete',
      inventorJournalSummary: 'Eight months of development logs covering relay driver circuits, time-window scheduling algorithm design, and field test results from a 4-farm pilot in Pune district.',
      priorArtSearchSummary: 'Searched Indian Patent Office database and international equivalents. Existing smart valve patents target single-farm setups; none address shared-pipeline fairness scheduling across multiple independent land holdings.',
      prototypeStatus: 'validated_prototype',
      specificationDraft: 'The invention relates to an adaptive irrigation valve controller that coordinates water distribution across shared pipelines serving multiple small farm plots using a time-window fairness algorithm.',
      abstractDraft: 'An embedded controller for shared irrigation pipelines that schedules valve open/close cycles to ensure equitable water distribution across clustered farm plots, using telemetry-based usage estimation and a fairness-weighted scheduling algorithm.',
      claimsDraft: '1. A valve controller comprising a relay driver, a scheduling module, and a telemetry unit, configured to manage water distribution across a shared irrigation pipeline. 2. The controller as in claim 1, wherein scheduling is computed using a fairness-weighted time-window algorithm.',
      drawingsPrepared: true,
      drawingsNotes: 'Six technical drawings: controller circuit schematic, pipeline topology, scheduling algorithm flowchart, mobile monitoring interface, field installation guide, and usage telemetry dashboard.',
      form1ApplicantDetailsConfirmed: true,
      form5InventorshipConfirmed: true,
      form26PowerOfAttorneyRequired: true,
      form26PowerOfAttorneyDetails: 'Power of attorney granted to patent agent registered with the Indian Patent Office. Form 26 signed and notarized on 2026-02-08.',
      examinationRequestPlan: 'Request for examination to be filed simultaneously with complete specification. Expedited examination to be considered if prior art search reveals critical conflicts.',
      publicDisclosureChecked: true,
      professionalSupportNeeded: true,
      costManagementNotes: 'Agent fees to be covered under the college innovation fund grant. Filing fee category: educational institution.',
    },
    supportingDocuments: [
      {
        fileUrl: 'https://res.cloudinary.com/demo/raw/upload/valve_controller_spec.pdf',
        fileType: 'pdf',
        fileName: 'ValveController_CompleteSpec.pdf',
        fileSizeBytes: 312320,
        note: 'Complete specification with all claims, drawings, and abstract as submitted to the patent agent.',
      },
    ],
    status: 'approved',
    submittedAt: new Date('2026-02-11T11:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-05T09:10:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'rohit',
    workspaceKey: 'rohit_solarnest',
    projectTitle: 'Compact Solar Tilt Learning Rig',
    questionnaire: {
      whatIsYourInnovation: 'A classroom rig that demonstrates how panel tilt changes power output over time.',
      noveltyExplanation: 'It packages a safe, low-cost learning experience with real-time output visualisation for students.',
      technicalDetails: 'The rig uses miniature solar panels, angle adjustment rails, and a basic analytics display.',
      marketUseCase: 'Useful for school science labs and innovation clubs teaching clean energy concepts.',
      priorArtAwareness: 'Compared school lab kits and focused on data visibility and repeatable experimentation.',
    },
    filingDocuments: {
      inventionCategory: 'mechanical_improvement',
      specificationType: 'provisional',
      inventorJournalSummary: 'Development notes from November 2025 to March 2026. Covers tilt mechanism iterations, power measurement circuit design, and student usability testing in two school science sessions.',
      priorArtSearchSummary: 'Searched existing educational science kits. Existing solar lab kits offer static setups; none provide an integrated adjustable tilt mechanism with live power analytics at the sub-INR-2000 target price.',
      prototypeStatus: 'working_prototype',
      specificationDraft: 'The invention relates to a compact solar energy learning rig with an adjustable panel tilt mechanism and a real-time power output analytics display, designed for use in school and college science laboratories.',
      abstractDraft: 'A low-cost, portable solar tilt demonstration rig that allows students to experimentally measure the effect of panel angle on power output, with real-time visualisation on an integrated display unit.',
      claimsDraft: '1. A solar demonstration rig comprising at least one miniature solar panel, an adjustable tilt rail, a power measurement circuit, and an output display. 2. The rig as in claim 1, wherein the tilt rail allows incremental angle adjustment from 0 to 90 degrees.',
      drawingsPrepared: true,
      drawingsNotes: 'Exploded assembly drawing and circuit schematic prepared. Dashboard UI screenshots included as supplementary reference.',
      form1ApplicantDetailsConfirmed: true,
      form5InventorshipConfirmed: true,
      form26PowerOfAttorneyRequired: false,
      examinationRequestPlan: 'Filing provisional to secure priority date. Complete specification to be filed within 12 months after finalizing the analytics firmware.',
      publicDisclosureChecked: false,
      professionalSupportNeeded: false,
      costManagementNotes: 'Self-filing at student rate. Mentor has reviewed the claims draft for completeness.',
    },
    supportingDocuments: [],
    status: 'submitted',
    submittedAt: new Date('2026-03-19T08:40:00.000Z'),
    scoreAwarded: false,
  },
];

const AWARD_SEEDS = [
  {
    studentKey: 'arjun',
    title: 'Smart India Hackathon 2025 Finalist',
    description: 'Recognized for presenting an AI-assisted crop diagnostics workflow with strong mentor validation and pilot readiness.',
    status: 'approved',
    submittedAt: new Date('2026-01-16T09:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-04T10:00:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'arjun',
    title: 'NITW Innovation Challenge Winner',
    description: 'Won the campus innovation challenge for demonstrating measurable field-test impact with AgriSense AI.',
    status: 'approved',
    submittedAt: new Date('2026-02-06T09:15:00.000Z'),
    adminReviewedAt: new Date('2026-03-04T10:30:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'priya',
    title: 'Best AgriTech Prototype Award',
    description: 'Awarded for designing a resilient IoT prototype for irrigation support in semi-urban farming environments.',
    status: 'approved',
    submittedAt: new Date('2026-02-22T08:45:00.000Z'),
    adminReviewedAt: new Date('2026-03-04T11:00:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'arjun',
    title: 'Best Campus AI Builder Award',
    description: 'Recognized for delivering a field-usable AI diagnostic workflow and clear product execution.',
    status: 'approved',
    submittedAt: new Date('2026-03-01T08:45:00.000Z'),
    adminReviewedAt: new Date('2026-03-05T11:15:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'priya',
    title: 'Embedded Systems Excellence Badge',
    description: 'Honored for engineering dependable sensing hardware with strong calibration results.',
    status: 'approved',
    submittedAt: new Date('2026-03-03T09:10:00.000Z'),
    adminReviewedAt: new Date('2026-03-05T11:45:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'rohit',
    title: 'Young Energy Innovator Mention',
    description: 'Received a special mention for building an engaging renewable-energy classroom prototype.',
    status: 'approved',
    submittedAt: new Date('2026-03-10T08:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-11T10:00:00.000Z'),
    scoreAwarded: true,
  },
];

const DEAL_SEEDS = [
  {
    startupKey: 'agrisense',
    studentKey: 'arjun',
    investorKey: 'investor',
    investorType: 'sole',
    amountINR: 850000,
    equityPercent: 24.5,
    sharesAllocated: 245,
    investorRole: 'director',
    votingWeight: 51,
    canVeto: true,
    canAccessFinancials: true,
    canRequestUpdates: true,
    stage: 4,
    fundTransferInitiatedAt: SEED_DEAL_FUND_TRANSFER_AT,
    adminApprovalRequired: true,
    adminApprovedAt: SEED_DEAL_APPROVED_AT,
    closedAt: SEED_DEAL_CLOSED_AT,
    innovationScoreSnapshot: 340,
    status: 'closed',
  },
  {
    startupKey: 'soilmesh',
    studentKey: 'priya',
    investorKey: 'investor',
    investorType: 'penny',
    amountINR: 120000,
    equityPercent: 3.5,
    sharesAllocated: 35,
    investorRole: 'observer',
    votingWeight: 3.5,
    canVeto: false,
    canAccessFinancials: false,
    canRequestUpdates: true,
    stage: 2,
    fundTransferInitiatedAt: new Date('2026-03-24T10:30:00.000Z'),
    adminApprovalRequired: false,
    innovationScoreSnapshot: 245,
    status: 'active',
  },
  {
    startupKey: 'solarnest',
    studentKey: 'rohit',
    investorKey: 'investor',
    investorType: 'penny',
    amountINR: 60000,
    equityPercent: 2,
    sharesAllocated: 20,
    investorRole: 'observer',
    votingWeight: 2,
    canVeto: false,
    canAccessFinancials: false,
    canRequestUpdates: true,
    stage: 1,
    adminApprovalRequired: false,
    innovationScoreSnapshot: 125,
    status: 'active',
  },
];

const WORKSPACE_SEEDS = [
  {
    key: 'arjun_agrisense',
    ownerKey: 'arjun',
    teamMemberKeys: ['priya'],
    title: 'AgriSense AI — Edge Disease Detection',
    category: 'AgriTech',
    stage: 'Patent',
    progressPercent: 82,
    milestones: [
      { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
      { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
      { name: 'Development', isCompleted: true, completionPercent: 100 },
      { name: 'Testing & Validation', isCompleted: false, completionPercent: 65 },
      { name: 'Final Delivery', isCompleted: false, completionPercent: 10 },
    ],
    tasks: [
      { title: 'Finalize CNN model quantization for Raspberry Pi', priority: 'High', done: true, createdAt: new Date('2026-01-10T09:00:00.000Z') },
      { title: 'Write technical spec for patent filing', priority: 'High', done: true, createdAt: new Date('2026-01-20T10:00:00.000Z') },
      { title: 'Run field accuracy validation — second round', priority: 'High', done: false, createdAt: new Date('2026-03-01T09:00:00.000Z') },
      { title: 'Prepare mentor review deck', priority: 'Medium', done: false, createdAt: new Date('2026-03-10T11:00:00.000Z') },
    ],
    repoSubmissions: [
      { provider: 'github', repoUrl: 'https://github.com/arjun-promove/agrisense-edge', displayName: 'agrisense-edge', branch: 'main', commitHash: 'a3c1f8d', note: 'Main development branch — all milestones through Development complete.' },
    ],
    codeSubmissions: [
      { title: 'Disease classifier inference wrapper', language: 'Python', summary: 'Wraps the TFLite model for on-device inference and formats results for the advisory API.', codeSnippet: 'def classify(image_path):\n    model = load_tflite_model()\n    input_data = preprocess(image_path)\n    output = model.run(input_data)\n    return parse_output(output)', lineCount: 28 },
    ],
    progressUpdates: [
      { note: 'Completed field validation round 1 across 3 farm clusters. Accuracy at 84% on test dataset.', milestoneRef: 'Testing & Validation', submittedAt: new Date('2026-02-28T10:00:00.000Z') },
      { note: 'Patent provisional filed. Admin review in progress.', submittedAt: new Date('2026-03-05T09:00:00.000Z') },
    ],
  },
  {
    key: 'priya_soilmesh',
    ownerKey: 'priya',
    teamMemberKeys: [],
    title: 'SoilMesh — Distributed Soil Monitoring Network',
    category: 'AgriTech',
    stage: 'Build',
    progressPercent: 60,
    milestones: [
      { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
      { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
      { name: 'Development', isCompleted: false, completionPercent: 70 },
      { name: 'Testing & Validation', isCompleted: false, completionPercent: 10 },
      { name: 'Final Delivery', isCompleted: false, completionPercent: 0 },
    ],
    tasks: [
      { title: 'Finalize ESP32 mesh routing logic', priority: 'High', done: true, createdAt: new Date('2026-01-15T09:00:00.000Z') },
      { title: 'Calibrate pH sensor readings', priority: 'High', done: false, createdAt: new Date('2026-02-10T10:00:00.000Z') },
      { title: 'Build farmer mobile app MVP', priority: 'Medium', done: false, createdAt: new Date('2026-02-20T11:00:00.000Z') },
      { title: 'Write provisional patent specification', priority: 'High', done: true, createdAt: new Date('2026-03-01T09:00:00.000Z') },
    ],
    repoSubmissions: [
      { provider: 'github', repoUrl: 'https://github.com/priya-promove/soilmesh-node', displayName: 'soilmesh-node', branch: 'dev', note: 'Node firmware repository — mesh routing module complete.' },
    ],
    codeSubmissions: [
      { title: 'Mesh routing table update logic', language: 'C++', summary: 'Updates routing table when a neighbouring node becomes unreachable and selects the next best path.', codeSnippet: 'void updateRoute(NodeId failed) {\n  routes.erase(failed);\n  for (auto& node : knownNodes) {\n    if (node.reachable && node.id != failed) {\n      routes[failed] = node.id;\n      break;\n    }\n  }\n}', lineCount: 22 },
    ],
    progressUpdates: [
      { note: 'Mesh routing tested across 5 nodes in lab. Failover working correctly.', milestoneRef: 'Development', submittedAt: new Date('2026-02-15T10:00:00.000Z') },
    ],
  },
  {
    key: 'rohit_solarnest',
    ownerKey: 'rohit',
    teamMemberKeys: [],
    title: 'SolarNest — Clean Energy Platform',
    category: 'CleanTech',
    stage: 'Launch',
    progressPercent: 90,
    milestones: [
      { name: 'Research & Planning', isCompleted: true, completionPercent: 100 },
      { name: 'Design & Prototyping', isCompleted: true, completionPercent: 100 },
      { name: 'Development', isCompleted: true, completionPercent: 100 },
      { name: 'Testing & Validation', isCompleted: true, completionPercent: 100 },
      { name: 'Final Delivery', isCompleted: false, completionPercent: 50 },
    ],
    tasks: [
      { title: 'Finalize investor pitch deck', priority: 'High', done: true, createdAt: new Date('2026-01-05T09:00:00.000Z') },
      { title: 'Complete regulatory compliance checklist', priority: 'High', done: true, createdAt: new Date('2026-02-01T09:00:00.000Z') },
      { title: 'Onboard beta users for marketplace', priority: 'Medium', done: false, createdAt: new Date('2026-03-01T09:00:00.000Z') },
      { title: 'Submit patent for solar tilt rig', priority: 'Low', done: false, createdAt: new Date('2026-03-18T10:00:00.000Z') },
    ],
    repoSubmissions: [
      { provider: 'github', repoUrl: 'https://github.com/rohit-promove/solarnest-platform', displayName: 'solarnest-platform', branch: 'main', commitHash: 'f7a2b9c', note: 'Production-ready platform repository.' },
    ],
    codeSubmissions: [
      { title: 'Solar yield estimator', language: 'TypeScript', summary: 'Calculates expected annual yield in kWh given panel spec, tilt angle, and location coordinates.', codeSnippet: 'function estimateYield(panelKw: number, tilt: number, lat: number): number {\n  const irradiance = getAnnualIrradiance(lat, tilt);\n  return panelKw * irradiance * 0.85;\n}', lineCount: 18 },
    ],
    progressUpdates: [
      { note: 'Platform launched to mentor cohort. 28 active users in the first two weeks.', milestoneRef: 'Final Delivery', submittedAt: new Date('2026-03-20T09:00:00.000Z') },
    ],
  },
];

const PROBLEM_SEEDS = [
  {
    title: 'Early Crop Disease Detection in Low-Connectivity Rural Zones',
    description: 'Smallholder farms in Telangana and Andhra Pradesh lose 15-25% of crop yield annually due to delayed disease identification. Agri-extension workers have limited bandwidth and cannot monitor every farm plot. An offline-capable, low-cost diagnostic tool that can be operated by farmers without specialist training is needed.',
    category: 'Agriculture',
    difficulty: 'Hard',
    domain: 'AgriTech / Edge AI',
    tags: ['crop-disease', 'edge-ai', 'rural', 'offline-first'],
    isVerified: true,
    postedByKey: 'college',
    sponsorName: 'Telangana Agri-Innovation Cell',
    geography: 'Telangana, India',
    targetBeneficiaries: 'Smallholder farmers and farmer producer organizations operating in low-connectivity zones.',
    impactGoal: 'Reduce crop loss due to late disease detection by 40% across 500 farms within 18 months of deployment.',
    expectedOutcome: 'A validated prototype that can detect at least 5 common crop diseases from leaf images with >80% accuracy and operate without internet access.',
    deliverables: 'Hardware prototype, inference model, farmer-facing mobile UI, and a field validation report covering at least 3 farm clusters.',
    acceptanceCriteria: 'Prototype passes field accuracy validation, operates in zero-connectivity mode, and receives positive usability scores from at least 10 farmers.',
    constraints: 'Device cost must remain under INR 5,000. Must be operable by a non-technical farmer after 30 minutes of training.',
    publicationStatus: 'published',
    claimStatus: 'claimed',
    claimedByKey: 'arjun',
    claimedAt: new Date('2025-10-12T09:00:00.000Z'),
  },
  {
    title: 'Shared Irrigation Scheduling for Small Farm Clusters',
    description: 'In Pune and Nashik districts, groups of 3-8 smallholders share irrigation pipelines fed by a common borewell. Manual scheduling leads to disputes, water waste, and under-irrigation for downstream plots. An automated, fair-scheduling valve controller is needed to optimize distribution without farmer conflict.',
    category: 'Agriculture',
    difficulty: 'Medium',
    domain: 'IoT / Water Management',
    tags: ['irrigation', 'iot', 'fairness', 'shared-infrastructure'],
    isVerified: true,
    postedByKey: 'college',
    sponsorName: 'Maharashtra Jal Pradhikaran Innovation Fund',
    geography: 'Maharashtra, India',
    targetBeneficiaries: 'Farm clusters sharing borewell-fed irrigation pipelines.',
    impactGoal: 'Eliminate scheduling disputes and reduce water waste by 30% across 20 pilot farm clusters.',
    expectedOutcome: 'An embedded controller that manages shared valve timing using a fairness algorithm, with telemetry accessible via mobile.',
    deliverables: 'Controller prototype, scheduling firmware, mobile monitoring app, and a 6-month pilot report.',
    acceptanceCriteria: 'Controller operates reliably for 6 months without manual intervention. All member farms receive scheduled access within ±5 minutes of planned time.',
    constraints: 'Solution must work without a stable internet connection. Hardware must survive outdoor monsoon conditions.',
    publicationStatus: 'published',
    claimStatus: 'claimed',
    claimedByKey: 'priya',
    claimedAt: new Date('2025-11-03T10:00:00.000Z'),
  },
  {
    title: 'Rooftop Solar Yield Prediction for Urban Residential Buildings',
    description: 'Urban households in Tier-2 cities are interested in rooftop solar but cannot reliably estimate ROI without expensive assessments. A web-based tool that uses building metadata, satellite irradiance data, and local net-metering tariffs to estimate yield and payback period would accelerate adoption.',
    category: 'Environment',
    difficulty: 'Medium',
    domain: 'CleanTech / SaaS',
    tags: ['solar', 'rooftop', 'urban', 'yield-prediction'],
    isVerified: true,
    postedByKey: 'college',
    sponsorName: 'MNRE Student Innovation Program',
    geography: 'India — Tier 2 cities',
    targetBeneficiaries: 'Urban homeowners and housing societies evaluating rooftop solar installations.',
    impactGoal: 'Enable 1,000 households to make informed solar adoption decisions in the first year of platform availability.',
    expectedOutcome: 'A web platform that generates a solar yield estimate and payback analysis from basic building and location inputs within 2 minutes.',
    deliverables: 'Web application, yield calculation engine, irradiance data integration, and a user testing report.',
    acceptanceCriteria: 'Yield estimates are within 10% of actual measurements for 80% of test cases using publicly available irradiance benchmarks.',
    constraints: 'Must be free to use for individual households. API call costs must remain under INR 2 per estimate.',
    publicationStatus: 'published',
    claimStatus: 'open',
  },
  {
    title: 'Student Innovation Portfolio Verification for Campus Placements',
    description: 'Recruiters visiting campuses cannot efficiently verify the authenticity or depth of student innovation portfolios. A system that records verifiable innovation milestones (hackathon wins, patents filed, prototype demos) with institutional endorsement would help recruiters make faster, more confident shortlisting decisions.',
    category: 'Education',
    difficulty: 'Easy',
    domain: 'EdTech / HR Tech',
    tags: ['portfolio', 'verification', 'recruitment', 'innovation'],
    isVerified: false,
    postedByKey: 'school',
    geography: 'India',
    targetBeneficiaries: 'Campus recruiters, placement officers, and students seeking innovation-track placements.',
    impactGoal: 'Reduce recruiter shortlisting time by 50% for innovation-track candidates at participating institutions.',
    expectedOutcome: 'A platform feature that lets institutions endorse student innovation records and lets recruiters filter by verified milestones.',
    deliverables: 'Endorsement workflow, recruiter filter UI, and audit trail for endorsed records.',
    acceptanceCriteria: 'Recruiters can filter and shortlist candidates by innovation score and verified milestones in under 5 minutes per cohort.',
    constraints: 'Must integrate with existing institution onboarding flow. No additional login for students.',
    publicationStatus: 'published',
    claimStatus: 'open',
  },
  {
    title: 'Low-Cost Renewable Energy Lab Kit for School Science Programs',
    description: 'Most school science labs in government and semi-urban schools cannot afford commercial lab kits that demonstrate renewable energy concepts. A sub-INR-2000 DIY-style kit covering solar, wind, and basic energy storage demonstrations is needed, with curriculum-aligned activity guides.',
    category: 'Education',
    difficulty: 'Easy',
    domain: 'CleanTech / Education',
    tags: ['school', 'lab-kit', 'renewable-energy', 'low-cost'],
    isVerified: false,
    postedByKey: 'school',
    geography: 'India',
    targetBeneficiaries: 'Government and semi-urban school science teachers and students.',
    impactGoal: 'Provide 500 schools with an affordable, curriculum-aligned renewable energy lab kit within 2 years.',
    expectedOutcome: 'A reproducible kit design with sourcing guide, assembly instructions, and 5 curriculum-aligned activity modules.',
    deliverables: 'Kit prototype, bill of materials, sourcing guide, activity guide, and teacher training materials.',
    acceptanceCriteria: 'Kit can be fully assembled by a teacher with basic electronics familiarity in under 45 minutes. All activities align with NCERT Class 8-10 science curriculum.',
    constraints: 'Total component cost must remain under INR 1,500. Components must be available from local electronics distributors.',
    publicationStatus: 'draft',
    claimStatus: 'open',
  },
];

const MENTOR_SESSION_SEEDS = [
  {
    mentorKey: 'mentor',
    studentKey: 'arjun',
    workspaceKey: 'arjun_agrisense',
    title: 'Patent Strategy Review — AgriSense',
    scheduledAt: new Date('2026-02-20T10:00:00.000Z'),
    durationMinutes: 45,
    meetLink: 'https://meet.google.com/demo-agrisense-patent',
    status: 'Completed',
    mentorNotes: 'Reviewed the provisional specification draft. Claims are well-scoped for a provisional. Suggested Arjun clarify the offline inference claim to distinguish from existing mobile vision tools. Recommended converting to complete specification within 10 months. Score looks strong — innovation breakdown is above peer median.',
    studentFeedback: 'Very useful session. The claim differentiation advice helped a lot. Will revise the novelty section before the next review.',
  },
  {
    mentorKey: 'mentor',
    studentKey: 'arjun',
    workspaceKey: 'arjun_agrisense',
    title: 'Field Validation Debrief and Startup Readiness',
    scheduledAt: new Date('2026-03-06T11:00:00.000Z'),
    durationMinutes: 60,
    meetLink: 'https://meet.google.com/demo-agrisense-startup',
    status: 'Completed',
    mentorNotes: 'Field validation results are promising. 84% accuracy is competitive for this deployment context. Advised Arjun to document the failure cases clearly for the admin review. Also discussed the AgriSense startup launch checklist — pitch deck needs a stronger market sizing section.',
    studentFeedback: 'Appreciated the detailed feedback on the failure case documentation. Will update the validation report before submitting to admin.',
  },
  {
    mentorKey: 'mentor',
    studentKey: 'priya',
    workspaceKey: 'priya_soilmesh',
    title: 'Mesh Routing Architecture Review',
    scheduledAt: new Date('2026-02-25T14:00:00.000Z'),
    durationMinutes: 45,
    meetLink: 'https://meet.google.com/demo-soilmesh-arch',
    status: 'Completed',
    mentorNotes: 'Priya has a solid understanding of the mesh protocol. Suggested increasing the test node count to 8 before field deployment. Discussed the provisional patent timeline — filing within the next 2 weeks is advisable given the upcoming college innovation showcase.',
    studentFeedback: 'The node count suggestion is actionable. Will also add a redundancy test case to the test suite before the showcase.',
  },
  {
    mentorKey: 'mentor',
    studentKey: 'rohit',
    workspaceKey: 'rohit_solarnest',
    title: 'Investor Pitch Preparation',
    scheduledAt: new Date('2026-04-05T15:00:00.000Z'),
    durationMinutes: 60,
    meetLink: 'https://meet.google.com/demo-solarnest-pitch',
    status: 'Scheduled',
    mentorNotes: undefined,
    studentFeedback: undefined,
  },
];

const MENTOR_FEEDBACK_SEEDS = [
  {
    mentorKey: 'mentor',
    studentKey: 'arjun',
    workspaceKey: 'arjun_agrisense',
    feedbackText: 'Arjun has demonstrated exceptional technical depth throughout the AgriSense project. His approach to the edge inference problem is well-reasoned and the field validation methodology is rigorous. The patent draft shows clear novelty scoping. Key area for growth: market sizing and commercial narrative in pitch materials.',
    rating: 5,
  },
  {
    mentorKey: 'mentor',
    studentKey: 'priya',
    workspaceKey: 'priya_soilmesh',
    feedbackText: 'Priya has built a technically sound prototype and shown good instincts for hardware-software integration. The mesh routing implementation handles failure cases better than similar student projects I have reviewed. She would benefit from more structured testing documentation before the patent filing.',
    rating: 4,
  },
  {
    mentorKey: 'mentor',
    studentKey: 'rohit',
    workspaceKey: 'rohit_solarnest',
    feedbackText: 'Rohit has taken SolarNest from concept to a live platform with real users in under 9 months, which is an impressive execution pace for a student founder. The platform architecture is clean and investor-ready. Main feedback: the traction metrics slide needs to be sharper before the next pitch round.',
    rating: 5,
  },
];

const JOB_POST_SEEDS = [
  {
    recruiterKey: 'recruiter',
    title: 'AgriTech Product Intern — Embedded Systems',
    company: 'GreenField Innovations Pvt Ltd',
    description: 'We are building the next generation of precision agriculture hardware for smallholder farms. Looking for a motivated intern with experience in embedded systems, sensor interfacing, and IoT protocols. You will work directly with our product team on field-ready hardware for the Kharif 2026 season.',
    domain: 'AgriTech',
    minimumInnovationScore: 80,
    type: 'Internship',
    location: 'Hyderabad (Hybrid)',
    isActive: true,
    expiresAt: new Date('2026-05-31T23:59:59.000Z'),
  },
  {
    recruiterKey: 'recruiter',
    title: 'Full-Stack Engineer — CleanTech Platform',
    company: 'SunBridge Energy Technologies',
    description: 'SunBridge is scaling its B2C rooftop solar marketplace across 12 Indian cities. We are hiring a full-stack engineer to own the consumer-facing yield estimation and order management modules. Strong preference for candidates with prior startup or innovation project experience.',
    domain: 'CleanTech',
    minimumInnovationScore: 100,
    type: 'Full-time',
    location: 'Pune (On-site)',
    isActive: true,
    expiresAt: new Date('2026-06-30T23:59:59.000Z'),
  },
  {
    recruiterKey: 'recruiter',
    title: 'Hardware Prototype Engineer — Innovation Track',
    company: 'Bharat Lab Works',
    description: 'Bharat Lab Works designs and manufactures low-cost science lab kits for government school programs across India. We are looking for an engineer with hands-on prototype experience to join our kit design team. Projects include electronics, mechanical assembly, and curriculum integration.',
    domain: 'Education / Hardware',
    minimumInnovationScore: 60,
    type: 'Full-time',
    location: 'Bengaluru (On-site)',
    isActive: true,
    expiresAt: new Date('2026-07-15T23:59:59.000Z'),
  },
];

const CAMPUS_DRIVE_SEEDS = [
  {
    recruiterKey: 'recruiter',
    institutionKey: 'college',
    title: 'GreenField Innovations Campus Placement Drive 2026',
    description: 'GreenField Innovations is conducting on-campus interviews for embedded systems and IoT roles. Shortlisted candidates will be invited for a technical round followed by a product design interview. Innovation score is a key shortlisting criterion alongside technical assessment.',
    type: 'Placement Drive',
    scheduledAt: new Date('2026-04-20T09:00:00.000Z'),
    minimumInnovationScore: 80,
    isActive: true,
    registeredStudentKeys: ['arjun', 'priya'],
  },
  {
    recruiterKey: 'recruiter',
    institutionKey: 'college',
    title: 'SunBridge Energy Hackathon — CleanTech Innovation Challenge',
    description: 'A 24-hour hackathon organized by SunBridge Energy Technologies for students with demonstrated CleanTech project experience. Participants will prototype a solar energy access solution for a rural or semi-urban context. Top 3 teams will receive funding and mentorship.',
    type: 'Hackathon',
    scheduledAt: new Date('2026-05-10T08:00:00.000Z'),
    minimumInnovationScore: 50,
    isActive: true,
    registeredStudentKeys: ['rohit', 'priya'],
  },
];

const createUserPayload = (seed, passwordHash, options = {}) => {
  const institution = options.institution ?? null;
  const payload = {
    email: seed.email,
    passwordHash,
    role: seed.role,
    displayName: seed.displayName,
    profileSlug: seed.profileSlug,
    accessGrantedBy: seed.accessGrantedBy,
    accessExpiresAt: new Date(Date.now() + ONE_YEAR_MS),
    isActive: seed.isActive ?? true,
    bio: seed.bio ?? '',
    headline: seed.headline ?? '',
    location: seed.location ?? '',
    domain: seed.domain ?? undefined,
    innovationScore: seed.innovationScore ?? 0,
    scoreBreakdown: createScoreBreakdown(seed.scoreBreakdown),
    profileComplete: seed.profileComplete ?? false,
    registrationStage: seed.registrationStage ?? 'basic',
    verificationStatus: seed.verificationStatus ?? 'not_required',
    institutionVerificationStatus: seed.institutionVerificationStatus ?? 'none',
    discoverableToRecruiters: seed.discoverableToRecruiters ?? false,
    isProfilePublic: seed.isProfilePublic ?? true,
    institutionToken: seed.institutionToken ?? null,
    institutionId: institution?._id ?? null,
    institutionProfile: seed.role === UserRole.SCHOOL || seed.role === UserRole.COLLEGE
      ? cloneInstitutionProfile(seed.institutionProfile)
      : institution?.institutionProfile
        ? cloneInstitutionProfile(institution.institutionProfile)
        : undefined,
    institutionVerifiedAt: seed.institutionVerifiedAt ?? null,
    verificationRequestedAt: seed.verificationRequestedAt ?? undefined,
    verifiedAt: seed.verifiedAt ?? undefined,
    adminApprovalStatus: seed.adminApprovalStatus ?? 'not_required',
    adminApprovalRequestedAt: seed.adminApprovalRequestedAt ?? undefined,
    adminApprovedAt: options.adminApprovedAt ?? seed.adminApprovedAt ?? undefined,
    adminApprovedBy: options.adminApprovedBy ?? null,
    skills: clone(seed.skills ?? []),
    experience: clone(seed.experience ?? []),
    education: clone(seed.education ?? []),
    certifications: clone(seed.certifications ?? []),
    portfolioProjects: clone(seed.portfolioProjects ?? []),
    lastLogin: seed.lastLogin ?? undefined,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

const upsertUser = async (seed, passwordHash, options = {}) =>
  User.findOneAndUpdate({ email: seed.email }, createUserPayload(seed, passwordHash, options), {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });

const seedInstitutionArtifacts = async (institutionsByKey, studentsByKey) => {
  for (const tokenSeed of [
    { token: DEMO_TOKENS.school, institutionId: institutionsByKey.school._id, institutionRole: UserRole.SCHOOL, createdBy: institutionsByKey.school._id, label: 'School demo admission token', usageCount: 2 },
    { token: DEMO_TOKENS.college, institutionId: institutionsByKey.college._id, institutionRole: UserRole.COLLEGE, createdBy: institutionsByKey.college._id, label: 'College demo admission token', usageCount: 2 },
  ]) {
    await StudentAccessToken.findOneAndUpdate({ token: tokenSeed.token }, { ...tokenSeed, expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });
  }

  for (const rosterSeed of ROSTER_SEEDS) {
    const institution = institutionsByKey[rosterSeed.institutionKey];
    const student = studentsByKey[rosterSeed.studentKey];
    await InstitutionStudentRosterEntry.findOneAndUpdate(
      { institutionId: institution._id, email: rosterSeed.email },
      {
        institutionId: institution._id,
        institutionRole: institution.role,
        createdBy: institution._id,
        displayName: rosterSeed.displayName,
        email: rosterSeed.email,
        gradeOrProgram: rosterSeed.gradeOrProgram,
        rollNumber: rosterSeed.rollNumber,
        source: 'manual',
        status: rosterSeed.status,
        linkedUserId: student?._id ?? null,
        registeredAt: rosterSeed.registeredAt ?? undefined,
        reviewedAt: rosterSeed.reviewedAt ?? undefined,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const seedProjectArtifacts = async (usersByKey, studentsByKey, institutionsByKey) => {
  const resolveUser = (key) => studentsByKey[key] ?? usersByKey[key] ?? null;
  const projectsByKey = {};
  const boardsByProjectKey = {};
  const teamsByKey = {};
  const sprintsByKey = {};
  const studentProjectMap = new Map();
  const studentTeamMap = new Map();

  for (const profileSeed of STUDENT_PROFILE_SEEDS) {
    const student = studentsByKey[profileSeed.studentKey];
    const institution = institutionsByKey[profileSeed.institutionKey];
    const mentor = resolveUser(profileSeed.mentorKey);

    await StudentProfile.findOneAndUpdate(
      { userId: student._id },
      {
        userId: student._id,
        mentorId: mentor?._id ?? null,
        leaderboardScore: profileSeed.leaderboardScore,
        edtechCourses: clone(profileSeed.edtechCourses),
        schoolId: institution?.role === UserRole.SCHOOL ? institution._id : null,
        collegeId: institution?.role === UserRole.COLLEGE ? institution._id : null,
        bio: profileSeed.bio,
        skills: clone(profileSeed.skills),
        githubUrl: profileSeed.githubUrl,
        linkedinUrl: profileSeed.linkedinUrl,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const projectSeed of PROJECT_SEEDS) {
    const leadStudent = studentsByKey[projectSeed.leadStudentKey];
    const mentor = projectSeed.mentorKey ? resolveUser(projectSeed.mentorKey) : null;
    const investor = projectSeed.investorKey ? resolveUser(projectSeed.investorKey) : null;
    const institution = projectSeed.institutionKey ? institutionsByKey[projectSeed.institutionKey] : null;

    const projectDoc = await Project.findOneAndUpdate(
      { slug: projectSeed.slug },
      {
        title: projectSeed.title,
        slug: projectSeed.slug,
        description: projectSeed.description,
        leadStudentId: leadStudent._id,
        mentorId: mentor?._id ?? null,
        investorId: investor?._id ?? null,
        collegeId: institution?._id ?? null,
        status: projectSeed.status,
        tags: clone(projectSeed.tags),
        techStack: clone(projectSeed.techStack),
        isPublic: projectSeed.isPublic,
        marketplaceListing: clone(projectSeed.marketplaceListing),
        pitchRequests: projectSeed.pitchRequests.map((entry) => ({
          investorId: resolveUser(entry.investorKey)?._id ?? null,
          status: entry.status,
          feedback: entry.feedback,
          meetingId: entry.meetingId ?? null,
        })),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    projectsByKey[projectSeed.key] = projectDoc;
    studentProjectMap.set(projectSeed.leadStudentKey, [...(studentProjectMap.get(projectSeed.leadStudentKey) ?? []), projectDoc._id]);

    const boardDoc = await Board.findOneAndUpdate(
      { projectId: projectDoc._id },
      {
        projectId: projectDoc._id,
        name: projectSeed.boardName,
        columns: clone(DEFAULT_BOARD_COLUMNS),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    boardsByProjectKey[projectSeed.key] = boardDoc;
  }

  for (const teamSeed of TEAM_SEEDS) {
    const lead = resolveUser(teamSeed.leadKey);
    const project = projectsByKey[teamSeed.projectKey];

    const teamDoc = await Team.findOneAndUpdate(
      { name: teamSeed.name, leadId: lead._id },
      {
        name: teamSeed.name,
        projectId: project._id,
        leadId: lead._id,
        members: teamSeed.members.map((member) => ({
          userId: resolveUser(member.userKey)._id,
          role: member.role,
          joinedAt: member.joinedAt,
        })),
        invitations: [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    teamsByKey[teamSeed.key] = teamDoc;

    for (const member of teamSeed.members) {
      const memberProjects = studentProjectMap.get(member.userKey) ?? [];
      if (!memberProjects.some((projectId) => String(projectId) === String(project._id))) {
        memberProjects.push(project._id);
      }
      studentProjectMap.set(member.userKey, memberProjects);
      if (!studentTeamMap.has(member.userKey)) {
        studentTeamMap.set(member.userKey, teamDoc._id);
      }
    }
  }

  for (const projectSeed of PROJECT_SEEDS) {
    const project = projectsByKey[projectSeed.key];
    const board = boardsByProjectKey[projectSeed.key];
    const team = TEAM_SEEDS.find((entry) => entry.projectKey === projectSeed.key);

    await Project.findByIdAndUpdate(project._id, {
      jiraBoard: board._id,
      teamId: team ? teamsByKey[team.key]._id : null,
    });
  }

  for (const sprintSeed of SPRINT_SEEDS) {
    const board = boardsByProjectKey[sprintSeed.projectKey];
    const sprintDoc = await Sprint.findOneAndUpdate(
      { boardId: board._id, name: sprintSeed.name },
      {
        boardId: board._id,
        name: sprintSeed.name,
        goal: sprintSeed.goal,
        startDate: sprintSeed.startDate,
        endDate: sprintSeed.endDate,
        status: sprintSeed.status,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    sprintsByKey[sprintSeed.key] = sprintDoc;
  }

  for (const ticketSeed of TICKET_SEEDS) {
    const board = boardsByProjectKey[ticketSeed.projectKey];
    const sprint = ticketSeed.sprintKey ? sprintsByKey[ticketSeed.sprintKey] : null;
    const assignee = ticketSeed.assigneeKey ? resolveUser(ticketSeed.assigneeKey) : null;
    const reporter = resolveUser(ticketSeed.reporterKey);

    await Ticket.findOneAndUpdate(
      { boardId: board._id, title: ticketSeed.title },
      {
        boardId: board._id,
        sprintId: sprint?._id ?? null,
        title: ticketSeed.title,
        description: ticketSeed.description,
        status: ticketSeed.status,
        priority: ticketSeed.priority,
        assigneeId: assignee?._id ?? null,
        reporterId: reporter._id,
        labels: clone(ticketSeed.labels),
        storyPoints: ticketSeed.storyPoints,
        dueDate: ticketSeed.dueDate,
        attachments: [],
        order: ticketSeed.order,
        comments: ticketSeed.comments.map((comment) => ({
          authorId: resolveUser(comment.authorKey)._id,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const profileSeed of STUDENT_PROFILE_SEEDS) {
    const student = studentsByKey[profileSeed.studentKey];
    await StudentProfile.findOneAndUpdate(
      { userId: student._id },
      {
        teamId: studentTeamMap.get(profileSeed.studentKey) ?? null,
        projectIds: studentProjectMap.get(profileSeed.studentKey) ?? [],
      },
      { new: true, runValidators: true },
    );
  }
};

const seedEventArtifacts = async (institutionsByKey, usersByKey, studentsByKey) => {
  const resolveUser = (key) => studentsByKey[key] ?? usersByKey[key] ?? null;

  for (const eventSeed of EVENT_SEEDS) {
    const institution = institutionsByKey[eventSeed.institutionKey];
    const createdBy = resolveUser(eventSeed.createdByKey);

    await Event.findOneAndUpdate(
      { institutionId: institution._id, title: eventSeed.title, scheduledAt: eventSeed.scheduledAt },
      {
        institutionId: institution._id,
        createdBy: createdBy._id,
        title: eventSeed.title,
        type: eventSeed.type,
        description: eventSeed.description,
        scheduledAt: eventSeed.scheduledAt,
        isActive: true,
        participants: eventSeed.participants.map((participant) => ({
          studentId: studentsByKey[participant.studentKey]._id,
          submissionScore: participant.submissionScore,
          joinedAt: participant.joinedAt,
        })),
        rankings: eventSeed.rankings.map((ranking) => ({
          rank: ranking.rank,
          studentId: studentsByKey[ranking.studentKey]._id,
          compositeScore: ranking.compositeScore,
          innovationScore: ranking.innovationScore,
          submissionScore: ranking.submissionScore,
        })),
        rankingsComputedAt: eventSeed.rankingsComputedAt ?? undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const seedStartupArtifacts = async (studentsByKey, usersByKey, workspacesByKey) => {
  const startupsByKey = {};

  for (const startupSeed of STARTUP_SEEDS) {
    const founder = studentsByKey[startupSeed.founderKey];
    const soleInvestor = startupSeed.soleInvestorKey ? usersByKey[startupSeed.soleInvestorKey] : null;

    const startupDoc = await Startup.findOneAndUpdate(
      { name: startupSeed.name, founderIds: founder._id },
      {
        founderIds: [founder._id],
        name: startupSeed.name,
        tagline: startupSeed.tagline,
        category: startupSeed.category,
        stage: startupSeed.stage,
        pitchDeckUrl: startupSeed.pitchDeckUrl,
        teamSize: startupSeed.teamSize,
        fundingNeeded: startupSeed.fundingNeeded,
        activeProducts: startupSeed.activeProducts,
        launchedToInvestors: startupSeed.launchedToInvestors,
        launchedToMentors: startupSeed.launchedToMentors,
        launchedToRecruiters: startupSeed.launchedToRecruiters,
        launchedAt: startupSeed.launchedAt,
        innovationScoreAtLaunch: startupSeed.innovationScoreAtLaunch,
        totalShares: startupSeed.totalShares,
        availableShares: startupSeed.availableShares,
        reservedForSole: startupSeed.reservedForSole,
        maxPennyInvestors: startupSeed.maxPennyInvestors,
        currentPennyCount: startupSeed.currentPennyCount,
        hasSoleInvestor: startupSeed.hasSoleInvestor,
        soleInvestorId: soleInvestor?._id ?? null,
        traction: clone(startupSeed.traction),
        isActive: startupSeed.isActive,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    startupsByKey[startupSeed.key] = startupDoc;
  }

  for (const patentSeed of PATENT_SEEDS) {
    const student = studentsByKey[patentSeed.studentKey];
    const workspace = workspacesByKey[patentSeed.workspaceKey] ?? null;
    await Patent.findOneAndUpdate(
      { studentId: student._id, projectTitle: patentSeed.projectTitle },
      {
        studentId: student._id,
        workspaceId: workspace?._id ?? undefined,
        projectTitle: patentSeed.projectTitle,
        questionnaire: clone(patentSeed.questionnaire),
        filingDocuments: clone(patentSeed.filingDocuments),
        supportingDocuments: clone(patentSeed.supportingDocuments ?? []),
        status: patentSeed.status,
        submittedAt: patentSeed.submittedAt,
        adminReviewedAt: patentSeed.adminReviewedAt ?? undefined,
        adminReviewedBy: patentSeed.adminReviewedAt ? usersByKey.admin._id : undefined,
        scoreAwarded: patentSeed.scoreAwarded,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const awardSeed of AWARD_SEEDS) {
    const student = studentsByKey[awardSeed.studentKey];
    await AdminAward.findOneAndUpdate(
      { studentId: student._id, title: awardSeed.title },
      {
        studentId: student._id,
        title: awardSeed.title,
        description: awardSeed.description,
        status: awardSeed.status,
        submittedAt: awardSeed.submittedAt,
        adminReviewedAt: awardSeed.adminReviewedAt ?? undefined,
        adminReviewedBy: awardSeed.adminReviewedAt ? usersByKey.admin._id : undefined,
        scoreAwarded: awardSeed.scoreAwarded,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const dealSeed of DEAL_SEEDS) {
    const startup = startupsByKey[dealSeed.startupKey];
    const student = studentsByKey[dealSeed.studentKey];
    const investor = usersByKey[dealSeed.investorKey];

    await Deal.findOneAndUpdate(
      { startupId: startup._id, investorId: investor._id },
      {
        startupId: startup._id,
        investorId: investor._id,
        studentId: student._id,
        investorType: dealSeed.investorType,
        amountINR: dealSeed.amountINR,
        equityPercent: dealSeed.equityPercent,
        sharesAllocated: dealSeed.sharesAllocated,
        investorRole: dealSeed.investorRole,
        votingWeight: dealSeed.votingWeight,
        canVeto: dealSeed.canVeto,
        canAccessFinancials: dealSeed.canAccessFinancials,
        canRequestUpdates: dealSeed.canRequestUpdates,
        stage: dealSeed.stage,
        fundTransferInitiatedAt: dealSeed.fundTransferInitiatedAt,
        adminApprovalRequired: dealSeed.adminApprovalRequired,
        adminApprovedAt: dealSeed.adminApprovedAt,
        adminApprovedBy: dealSeed.adminApprovedAt ? usersByKey.admin._id : undefined,
        closedAt: dealSeed.closedAt,
        innovationScoreSnapshot: dealSeed.innovationScoreSnapshot,
        status: dealSeed.status,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const seedWorkspaceArtifacts = async (studentsByKey, problemsByKey) => {
  const workspacesByKey = {};

  for (const wsSeed of WORKSPACE_SEEDS) {
    const owner = studentsByKey[wsSeed.ownerKey];
    const teamMemberIds = (wsSeed.teamMemberKeys ?? []).map((k) => studentsByKey[k]._id);

    const wsDoc = await Workspace.findOneAndUpdate(
      { ownerId: owner._id, title: wsSeed.title },
      {
        ownerId: owner._id,
        teamMemberIds,
        title: wsSeed.title,
        category: wsSeed.category,
        stage: wsSeed.stage,
        progressPercent: wsSeed.progressPercent,
        milestones: wsSeed.milestones.map((m) => ({
          name: m.name,
          isCompleted: m.isCompleted,
          completionPercent: m.completionPercent,
          completedAt: m.isCompleted ? new Date() : undefined,
          completedBy: m.isCompleted ? owner._id : undefined,
        })),
        tasks: wsSeed.tasks.map((t) => ({
          title: t.title,
          priority: t.priority,
          done: t.done,
          assignedTo: owner._id,
          createdAt: t.createdAt,
        })),
        repoSubmissions: wsSeed.repoSubmissions.map((r) => ({
          ...r,
          uploadedBy: owner._id,
          uploadedAt: new Date('2026-01-20T10:00:00.000Z'),
        })),
        codeSubmissions: wsSeed.codeSubmissions.map((c) => ({
          ...c,
          uploadedBy: owner._id,
          uploadedAt: new Date('2026-02-01T10:00:00.000Z'),
        })),
        progressUpdates: wsSeed.progressUpdates.map((u) => ({
          note: u.note,
          milestoneRef: u.milestoneRef ?? undefined,
          submittedBy: owner._id,
          submittedAt: u.submittedAt,
        })),
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    workspacesByKey[wsSeed.key] = wsDoc;
  }

  // Wire claimedProblemId after both workspaces and problems exist
  for (const problemSeed of PROBLEM_SEEDS) {
    if (problemSeed.claimedByKey && problemSeed.claimStatus === 'claimed') {
      const problem = problemsByKey[problemSeed.title];
      if (!problem) continue;
      const workspaceKey = WORKSPACE_SEEDS.find((ws) => ws.ownerKey === problemSeed.claimedByKey)?.key;
      if (!workspaceKey) continue;
      const ws = workspacesByKey[workspaceKey];
      if (!ws) continue;
      await Workspace.updateOne({ _id: ws._id }, { claimedProblemId: problem._id });
    }
  }

  return workspacesByKey;
};

const seedProblemBankArtifacts = async (usersByKey) => {
  const problemsByKey = {};

  for (const problemSeed of PROBLEM_SEEDS) {
    const postedBy = usersByKey[problemSeed.postedByKey];
    const claimedBy = problemSeed.claimedByKey ? usersByKey[problemSeed.claimedByKey] : undefined;

    // postedBy is a String field in the schema (display name or label)
    const postedByLabel = postedBy.displayName ?? postedBy.email;

    const problemDoc = await Problem.findOneAndUpdate(
      { title: problemSeed.title, postedBy: postedByLabel },
      {
        title: problemSeed.title,
        description: problemSeed.description,
        category: problemSeed.category,
        difficulty: problemSeed.difficulty,
        domain: problemSeed.domain,
        tags: clone(problemSeed.tags ?? []),
        isVerified: problemSeed.isVerified,
        postedBy: postedByLabel,
        createdByAdminId: undefined,
        sponsorName: problemSeed.sponsorName ?? undefined,
        geography: problemSeed.geography ?? undefined,
        // targetBeneficiaries, deliverables, acceptanceCriteria, constraints are [String] arrays
        targetBeneficiaries: problemSeed.targetBeneficiaries ? [problemSeed.targetBeneficiaries] : [],
        impactGoal: problemSeed.impactGoal ?? undefined,
        expectedOutcome: problemSeed.expectedOutcome ?? undefined,
        deliverables: problemSeed.deliverables ? [problemSeed.deliverables] : [],
        acceptanceCriteria: problemSeed.acceptanceCriteria ? [problemSeed.acceptanceCriteria] : [],
        constraints: problemSeed.constraints ? [problemSeed.constraints] : [],
        publicationStatus: problemSeed.publicationStatus,
        claimStatus: problemSeed.claimStatus,
        claimedBy: claimedBy?._id ?? undefined,
        claimedAt: problemSeed.claimedAt ?? undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    problemsByKey[problemSeed.title] = problemDoc;
  }

  return problemsByKey;
};

const seedMentorArtifacts = async (usersByKey, studentsByKey, workspacesByKey) => {
  for (const sessionSeed of MENTOR_SESSION_SEEDS) {
    const mentor = usersByKey[sessionSeed.mentorKey];
    const student = studentsByKey[sessionSeed.studentKey];
    const workspace = workspacesByKey[sessionSeed.workspaceKey] ?? null;

    await MentorSession.findOneAndUpdate(
      { mentorId: mentor._id, studentId: student._id, title: sessionSeed.title, scheduledAt: sessionSeed.scheduledAt },
      {
        mentorId: mentor._id,
        studentId: student._id,
        workspaceId: workspace?._id ?? undefined,
        title: sessionSeed.title,
        scheduledAt: sessionSeed.scheduledAt,
        durationMinutes: sessionSeed.durationMinutes,
        meetLink: sessionSeed.meetLink,
        status: sessionSeed.status,
        mentorNotes: sessionSeed.mentorNotes ?? undefined,
        studentFeedback: sessionSeed.studentFeedback ?? undefined,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const feedbackSeed of MENTOR_FEEDBACK_SEEDS) {
    const mentor = usersByKey[feedbackSeed.mentorKey];
    const student = studentsByKey[feedbackSeed.studentKey];
    const workspace = workspacesByKey[feedbackSeed.workspaceKey] ?? null;

    await MentorFeedback.findOneAndUpdate(
      { mentorId: mentor._id, studentId: student._id },
      {
        mentorId: mentor._id,
        studentId: student._id,
        workspaceId: workspace?._id ?? undefined,
        feedbackText: feedbackSeed.feedbackText,
        rating: feedbackSeed.rating,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const seedRecruiterArtifacts = async (usersByKey, studentsByKey, institutionsByKey) => {
  for (const jobSeed of JOB_POST_SEEDS) {
    const recruiter = usersByKey[jobSeed.recruiterKey];

    await JobPost.findOneAndUpdate(
      { recruiterId: recruiter._id, title: jobSeed.title },
      {
        recruiterId: recruiter._id,
        title: jobSeed.title,
        company: jobSeed.company,
        description: jobSeed.description,
        domain: jobSeed.domain,
        minimumInnovationScore: jobSeed.minimumInnovationScore,
        type: jobSeed.type,
        location: jobSeed.location,
        isActive: jobSeed.isActive,
        expiresAt: jobSeed.expiresAt,
        applicantIds: [],
        shortlistedIds: [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }

  for (const driveSeed of CAMPUS_DRIVE_SEEDS) {
    const recruiter = usersByKey[driveSeed.recruiterKey];
    const institution = institutionsByKey[driveSeed.institutionKey];

    await CampusDrive.findOneAndUpdate(
      { recruiterId: recruiter._id, title: driveSeed.title },
      {
        recruiterId: recruiter._id,
        collegeId: institution._id,
        title: driveSeed.title,
        description: driveSeed.description,
        type: driveSeed.type,
        scheduledAt: driveSeed.scheduledAt,
        minimumInnovationScore: driveSeed.minimumInnovationScore,
        isActive: driveSeed.isActive,
        registeredStudents: (driveSeed.registeredStudentKeys ?? []).map((k) => ({
          studentId: studentsByKey[k]._id,
          registeredAt: new Date('2026-03-25T10:00:00.000Z'),
        })),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const printSummary = (users) => {
  console.log('\n-------------------------------------------------');
  console.log('Quick seed complete');
  console.log('-------------------------------------------------');
  console.log(`Shared password: ${DEFAULT_PASSWORD}`);
  console.log(`Admin login: admin@promove.dev / ${ADMIN_PASSWORD}`);
  console.log(`School token:  ${DEMO_TOKENS.school}`);
  console.log(`College token: ${DEMO_TOKENS.college}`);
  console.log('-------------------------------------------------');
  users.forEach((user) => {
    const flags = [];
    if (user.role === UserRole.STUDENT && user.verificationStatus === 'pending') flags.push('pending institution approval');
    if (!user.isActive) flags.push('inactive');
    console.log(`  ${user.role.padEnd(10)} ${user.displayName} <${user.email}>${flags.length ? ` [${flags.join(', ')}]` : ''}`);
  });
  console.log('-------------------------------------------------\n');
};

const seedUsers = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const adminDoc = await upsertUser(ADMIN_SEED, adminHash);
    console.log(`OK [${adminDoc.role.padEnd(10)}] ${adminDoc.displayName}`);

    const usersByKey = { admin: adminDoc };
    const institutionsByKey = {};
    const seededNonStudents = [];
    for (const seed of NON_STUDENT_SEEDS) {
      const doc = await upsertUser(seed, defaultHash, { adminApprovedAt: ADMIN_APPROVED_AT, adminApprovedBy: adminDoc._id });
      seededNonStudents.push(doc);
      usersByKey[seed.key] = doc;
      if (seed.key === 'school' || seed.key === 'college') institutionsByKey[seed.key] = doc;
      console.log(`OK [${doc.role.padEnd(10)}] ${doc.displayName}`);
    }

    const studentsByKey = {};
    const seededStudents = [];
    for (const seed of STUDENT_SEEDS) {
      const doc = await upsertUser(seed, defaultHash, { institution: institutionsByKey[seed.institutionKey] });
      studentsByKey[seed.key] = doc;
      seededStudents.push(doc);
      console.log(`OK [${doc.role.padEnd(10)}] ${doc.displayName}`);
    }

    await seedInstitutionArtifacts(institutionsByKey, studentsByKey);
    console.log('OK [artifacts ] Demo tokens and roster entries');

    await seedProjectArtifacts(usersByKey, studentsByKey, institutionsByKey);
    console.log('OK [artifacts ] Demo profiles, projects, boards, teams, sprints, and tickets');

    await seedEventArtifacts(institutionsByKey, usersByKey, studentsByKey);
    console.log('OK [artifacts ] Demo events and rankings');

    const problemsByKey = await seedProblemBankArtifacts({ ...usersByKey, ...institutionsByKey });
    console.log('OK [artifacts ] Demo problem bank entries');

    const workspacesByKey = await seedWorkspaceArtifacts(studentsByKey, problemsByKey);
    console.log('OK [artifacts ] Demo workspaces with milestones, tasks, and submissions');

    await seedStartupArtifacts(studentsByKey, usersByKey, workspacesByKey);
    console.log('OK [artifacts ] Demo patents, awards, startups, and deals');

    await seedMentorArtifacts(usersByKey, studentsByKey, workspacesByKey);
    console.log('OK [artifacts ] Demo mentor sessions and feedback');

    await seedRecruiterArtifacts(usersByKey, studentsByKey, institutionsByKey);
    console.log('OK [artifacts ] Demo job posts and campus drives');

    printSummary([adminDoc, ...seededNonStudents, ...seededStudents]);
  } catch (error) {
    console.error('Seed error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void seedUsers();
