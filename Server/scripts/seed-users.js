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
    projectTitle: 'AgriSense Edge Disease Detection Kit',
    questionnaire: {
      whatIsYourInnovation: 'An edge-AI kit that detects early crop disease from leaf images without depending on continuous internet access.',
      noveltyExplanation: 'The solution combines lightweight vision inference, offline advisory prompts, and localized treatment suggestions for low-connectivity farms.',
      technicalDetails: 'The device uses an on-device CNN model, Raspberry Pi compute, and a mobile dashboard for agronomists to track field health.',
      marketUseCase: 'Farmer producer organizations and agri-input partners can use it to reduce crop loss and improve treatment turnaround times.',
      priorArtAwareness: 'Reviewed public agri-vision tools and positioned the novelty around offline deployment and advisory localization.',
    },
    status: 'approved',
    submittedAt: new Date('2026-02-18T10:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-04T09:00:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'priya',
    projectTitle: 'Mesh-Based Soil Monitoring Node',
    questionnaire: {
      whatIsYourInnovation: 'A low-cost IoT node network that measures moisture, pH, and ambient conditions across distributed plots.',
      noveltyExplanation: 'The system focuses on modular sensor replacement and mesh resilience for farms that cannot maintain gateway-heavy setups.',
      technicalDetails: 'It uses ESP32-based boards, solar trickle charging, and a mesh communication layer with a lightweight farmer app.',
      marketUseCase: 'Suitable for precision irrigation pilots in educational institutions and small agricultural research programs.',
      priorArtAwareness: 'Benchmarked existing precision irrigation devices and differentiated on modularity, repairability, and mesh-first design.',
    },
    status: 'under_review',
    submittedAt: new Date('2026-03-08T11:30:00.000Z'),
    scoreAwarded: false,
  },
  {
    studentKey: 'arjun',
    projectTitle: 'Localized Crop Recovery Recommendation Engine',
    questionnaire: {
      whatIsYourInnovation: 'A recommendation engine that maps detected crop conditions to localized recovery workflows.',
      noveltyExplanation: 'It links field condition signals with region-specific remediation advice and input availability constraints.',
      technicalDetails: 'The system combines crop metadata, disease confidence scores, and treatment catalogs into a recommendation workflow.',
      marketUseCase: 'Useful for agri advisors, FPOs, and rural incubation programs running crop support pilots.',
      priorArtAwareness: 'Compared existing advisory engines and focused novelty on localized remediation logic tied to edge diagnostics.',
    },
    status: 'submitted',
    submittedAt: new Date('2026-03-14T09:20:00.000Z'),
    scoreAwarded: false,
  },
  {
    studentKey: 'priya',
    projectTitle: 'Adaptive Valve Controller for Shared Irrigation Lines',
    questionnaire: {
      whatIsYourInnovation: 'A controller that balances irrigation timings across shared pipeline constraints in small farm clusters.',
      noveltyExplanation: 'The logic prioritizes water efficiency and fairness across low-resource irrigation schedules.',
      technicalDetails: 'It combines relay control, time-window balancing, and telemetry-based usage estimates.',
      marketUseCase: 'Designed for community irrigation pilots and campus agri research plots.',
      priorArtAwareness: 'Reviewed smart valve products and differentiated on shared-line coordination for clustered small farms.',
    },
    status: 'approved',
    submittedAt: new Date('2026-02-11T11:00:00.000Z'),
    adminReviewedAt: new Date('2026-03-05T09:10:00.000Z'),
    scoreAwarded: true,
  },
  {
    studentKey: 'rohit',
    projectTitle: 'Compact Solar Tilt Learning Rig',
    questionnaire: {
      whatIsYourInnovation: 'A classroom rig that demonstrates how panel tilt changes power output over time.',
      noveltyExplanation: 'It packages a safe, low-cost learning experience with real-time output visualisation for students.',
      technicalDetails: 'The rig uses miniature solar panels, angle adjustment rails, and a basic analytics display.',
      marketUseCase: 'Useful for school science labs and innovation clubs teaching clean energy concepts.',
      priorArtAwareness: 'Compared school lab kits and focused on data visibility and repeatable experimentation.',
    },
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

const seedStartupArtifacts = async (studentsByKey, usersByKey) => {
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
    await Patent.findOneAndUpdate(
      { studentId: student._id, projectTitle: patentSeed.projectTitle },
      {
        studentId: student._id,
        projectTitle: patentSeed.projectTitle,
        questionnaire: clone(patentSeed.questionnaire),
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

    await seedStartupArtifacts(studentsByKey, usersByKey);
    console.log('OK [artifacts ] Demo patents, awards, startups, and deals');

    printSummary([adminDoc, ...seededNonStudents, ...seededStudents]);
  } catch (error) {
    console.error('Seed error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void seedUsers();
