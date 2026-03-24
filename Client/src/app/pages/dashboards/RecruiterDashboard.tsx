import { useState } from "react";
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
  id: number;
  name: string;
  photo: string;
  college: string;
  course: string;
  graduationYear: number;
  innovationScore: number;
  skills: string[];
  latestProject: string;
  domain: string;
  availability: "Internship" | "Full-time";
  patentStatus: "Filed" | "Granted" | "None";
  cgpa: number;
  about?: string;
  projects?: Project[];
  internships?: Internship[];
  achievements?: Achievement[];
  mentorRecommendations?: MentorRecommendation[];
}

interface College {
  id: number;
  name: string;
  city: string;
  state: string;
  naacGrade: string;
  iicStars: number;
  nirfRank: number | null;
  activeStudents: number;
  topDomains: string[];
}

interface Drive {
  id: number;
  name: string;
  college: string;
  applications: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  status: "Active" | "Paused" | "Closed";
}

interface OnboardingCandidate {
  id: number;
  name: string;
  college: string;
  role: string;
  stage: "Offer Sent" | "Offer Accepted" | "Documents Submitted" | "Joining Confirmed" | "Day 1" | "30-Day Check-in";
  daysInStage: number;
}

interface DriveApplicant {
  id: number;
  name: string;
  college: string;
  innovationScore: number;
  stage: "Applied" | "Shortlisted" | "Interviewed" | "Offered" | "Joined";
  daysInStage: number;
}

export function RecruiterDashboard() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [searchMode, setSearchMode] = useState<SearchMode>("person");
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<number | null>(null);
  const [problemQuery, setProblemQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<number | null>(null);

  const stats = {
    openPositions: 12,
    totalApplicants: 248,
    shortlistedThisWeek: 34,
  };

  const newMatches: Student[] = [
    {
      id: 1,
      name: "Priya Sharma",
      photo: "PS",
      college: "IIT Delhi",
      course: "B.Tech CSE",
      graduationYear: 2026,
      innovationScore: 92,
      skills: ["Machine Learning", "React", "Python", "TensorFlow", "Node.js"],
      latestProject: "AI-powered Healthcare Diagnostics",
      domain: "HealthTech",
      availability: "Internship",
      patentStatus: "Filed",
      cgpa: 8.9,
      about: "Passionate innovator focused on using AI to solve critical healthcare challenges in rural India. Led 3 successful projects with patent applications and real-world impact.",
      projects: [
        {
          id: 1,
          title: "AI-powered Healthcare Diagnostics",
          problemStatement: "Rural healthcare centers lack access to specialized doctors, leading to misdiagnosis of critical conditions.",
          domain: "HealthTech",
          role: "Team Lead & ML Engineer",
          outcome: "Patent filed. Deployed in 3 rural clinics. 94% diagnostic accuracy achieved.",
          techStack: ["Python", "TensorFlow", "React", "Node.js"],
          mentor: "Dr. Rajesh Kumar, AIIMS Delhi",
          patentStatus: "Filed",
          timeline: "Aug 2025 - Present"
        },
        {
          id: 2,
          title: "MediConnect Telemedicine Platform",
          problemStatement: "Patients in remote areas cannot access specialist consultations.",
          domain: "HealthTech",
          role: "Full Stack Developer",
          outcome: "Served 500+ patients. Won Smart India Hackathon 2025.",
          techStack: ["React", "Firebase", "WebRTC"],
          patentStatus: "None",
          timeline: "Jan 2025 - Jun 2025"
        }
      ],
      internships: [
        {
          id: 1,
          company: "Practo",
          role: "Software Engineering Intern",
          duration: "May 2025 - Aug 2025",
          description: "Worked on telemedicine features, improving consultation booking flow and reducing load times by 40%."
        }
      ],
      achievements: [
        {
          id: 1,
          type: "patent",
          title: "Patent Filed - AI Diagnostic System",
          description: "Application #IN202601234",
          date: "Dec 2025"
        },
        {
          id: 2,
          type: "competition",
          title: "Winner - Smart India Hackathon 2025",
          description: "Healthcare category",
          date: "Aug 2025"
        },
        {
          id: 3,
          type: "badge",
          title: "ProMove Innovation Excellence Badge",
          description: "Top 1% innovators nationally",
          date: "Nov 2025"
        }
      ],
      mentorRecommendations: [
        {
          id: 1,
          mentorName: "Dr. Rajesh Kumar",
          mentorTitle: "Senior Consultant, AIIMS Delhi",
          recommendation: "Priya demonstrated exceptional problem-solving skills and technical expertise. Her AI diagnostics project has real potential to transform rural healthcare. Highly recommend for AI/ML roles.",
          date: "Jan 2026"
        }
      ]
    },
    {
      id: 2,
      name: "Arjun Mehta",
      photo: "AM",
      college: "BITS Pilani",
      course: "B.Tech ECE",
      graduationYear: 2025,
      innovationScore: 88,
      skills: ["IoT", "Embedded Systems", "C++", "Arduino", "Python"],
      latestProject: "Smart Agriculture Monitoring System",
      domain: "AgriTech",
      availability: "Full-time",
      patentStatus: "Granted",
      cgpa: 9.2,
      about: "IoT engineer passionate about sustainable agriculture. Successfully deployed solutions in 50+ farms across Rajasthan.",
      projects: [
        {
          id: 1,
          title: "Smart Agriculture Monitoring System",
          problemStatement: "Farmers lack real-time data on soil health, leading to crop failure and resource wastage.",
          domain: "AgriTech",
          role: "Hardware Lead",
          outcome: "Patent granted. Deployed in 50+ farms. 30% increase in crop yield reported.",
          techStack: ["Arduino", "IoT", "C++", "Python"],
          mentor: "Prof. Suresh Agarwal, BITS Pilani",
          patentStatus: "Granted",
          timeline: "Mar 2024 - Present"
        }
      ],
      internships: [
        {
          id: 1,
          company: "Agrostar",
          role: "IoT Engineering Intern",
          duration: "Jun 2024 - Dec 2024",
          description: "Developed sensor networks for precision agriculture. Reduced hardware costs by 25%."
        }
      ],
      achievements: [
        {
          id: 1,
          type: "patent",
          title: "Patent Granted - Smart Irrigation System",
          description: "Patent #IN234567",
          date: "Sep 2025"
        },
        {
          id: 2,
          type: "competition",
          title: "Finalist - Amazon Smbhav Hackathon",
          description: "AgriTech category",
          date: "Oct 2024"
        }
      ],
      mentorRecommendations: [
        {
          id: 1,
          mentorName: "Prof. Suresh Agarwal",
          mentorTitle: "Professor of Electronics, BITS Pilani",
          recommendation: "Arjun's IoT solutions are production-ready and scalable. He has excellent understanding of hardware-software integration. A valuable addition to any engineering team.",
          date: "Dec 2025"
        }
      ]
    },
    {
      id: 3,
      name: "Neha Desai",
      photo: "ND",
      college: "NIT Trichy",
      course: "B.Tech AI/ML",
      graduationYear: 2026,
      innovationScore: 85,
      skills: ["Deep Learning", "TensorFlow", "Data Science", "Python", "NLP"],
      latestProject: "Personalized Learning Platform",
      domain: "EdTech",
      availability: "Internship",
      patentStatus: "None",
      cgpa: 8.7,
      about: "AI researcher specializing in personalized education technology. Focused on making quality education accessible to all.",
      projects: [
        {
          id: 1,
          title: "Personalized Learning Platform",
          problemStatement: "One-size-fits-all education fails to address individual learning pace and style differences.",
          domain: "EdTech",
          role: "AI/ML Developer",
          outcome: "Used by 2000+ students. 40% improvement in learning outcomes.",
          techStack: ["Python", "TensorFlow", "React", "PostgreSQL"],
          mentor: "Dr. Anita Rao, NIT Trichy",
          patentStatus: "None",
          timeline: "Sep 2025 - Present"
        }
      ],
      achievements: [
        {
          id: 1,
          type: "competition",
          title: "2nd Place - Google AI Hackathon",
          description: "Education category",
          date: "Nov 2025"
        }
      ],
      mentorRecommendations: [
        {
          id: 1,
          mentorName: "Dr. Anita Rao",
          mentorTitle: "Associate Professor, NIT Trichy",
          recommendation: "Neha is a brilliant researcher with strong fundamentals in ML. Her personalized learning algorithms show deep understanding of both technology and pedagogy.",
          date: "Jan 2026"
        }
      ]
    },
  ];

  const recentActivity = [
    { student: "Rahul Kumar", action: "updated his profile", time: "2 hrs ago" },
    { student: "Sneha Patel", action: "completed a new project", time: "5 hrs ago" },
    { student: "Vikram Singh", action: "filed a patent application", time: "1 day ago" },
    { student: "Anjali Reddy", action: "won Smart India Hackathon", time: "2 days ago" },
  ];

  const colleges: College[] = [
    {
      id: 1,
      name: "IIT Delhi",
      city: "New Delhi",
      state: "Delhi",
      naacGrade: "A++",
      iicStars: 5,
      nirfRank: 2,
      activeStudents: 312,
      topDomains: ["AI/ML", "IoT", "HealthTech"],
    },
    {
      id: 2,
      name: "BITS Pilani",
      city: "Pilani",
      state: "Rajasthan",
      naacGrade: "A++",
      iicStars: 4,
      nirfRank: 23,
      activeStudents: 248,
      topDomains: ["AgriTech", "CleanTech", "EdTech"],
    },
    {
      id: 3,
      name: "NIT Trichy",
      city: "Tiruchirappalli",
      state: "Tamil Nadu",
      naacGrade: "A+",
      iicStars: 4,
      nirfRank: 9,
      activeStudents: 186,
      topDomains: ["FinTech", "EdTech", "AI/ML"],
    },
    {
      id: 4,
      name: "IIIT Hyderabad",
      city: "Hyderabad",
      state: "Telangana",
      naacGrade: "A++",
      iicStars: 5,
      nirfRank: 15,
      activeStudents: 201,
      topDomains: ["AI/ML", "Cybersecurity", "FinTech"],
    },
    {
      id: 5,
      name: "VIT Vellore",
      city: "Vellore",
      state: "Tamil Nadu",
      naacGrade: "A+",
      iicStars: 3,
      nirfRank: 16,
      activeStudents: 425,
      topDomains: ["IoT", "HealthTech", "EdTech"],
    },
    {
      id: 6,
      name: "Anna University",
      city: "Chennai",
      state: "Tamil Nadu",
      naacGrade: "A",
      iicStars: 3,
      nirfRank: 21,
      activeStudents: 289,
      topDomains: ["Manufacturing", "CleanTech", "AgriTech"],
    },
  ];

  const activeDrives: Drive[] = [
    {
      id: 1,
      name: "Software Engineering Internship 2026",
      college: "IIT Delhi",
      applications: 145,
      shortlisted: 32,
      interviewed: 12,
      offered: 5,
      status: "Active",
    },
    {
      id: 2,
      name: "Product Manager - Campus Hire",
      college: "BITS Pilani",
      applications: 89,
      shortlisted: 18,
      interviewed: 8,
      offered: 3,
      status: "Active",
    },
    {
      id: 3,
      name: "Data Science Internship",
      college: "NIT Trichy",
      applications: 67,
      shortlisted: 15,
      interviewed: 6,
      offered: 2,
      status: "Active",
    },
  ];

  const driveApplicants: DriveApplicant[] = [
    { id: 1, name: "Rahul Verma", college: "IIT Delhi", innovationScore: 89, stage: "Applied", daysInStage: 1 },
    { id: 2, name: "Priya Sharma", college: "IIT Delhi", innovationScore: 92, stage: "Applied", daysInStage: 2 },
    { id: 3, name: "Sneha Patel", college: "IIT Delhi", innovationScore: 85, stage: "Shortlisted", daysInStage: 3 },
    { id: 4, name: "Vikram Singh", college: "IIT Delhi", innovationScore: 88, stage: "Shortlisted", daysInStage: 2 },
    { id: 5, name: "Karan Joshi", college: "IIT Delhi", innovationScore: 91, stage: "Interviewed", daysInStage: 1 },
    { id: 6, name: "Anjali Reddy", college: "IIT Delhi", innovationScore: 87, stage: "Offered", daysInStage: 4 },
    { id: 7, name: "Rohan Gupta", college: "IIT Delhi", innovationScore: 90, stage: "Joined", daysInStage: 7 },
  ];

  const onboardingPipeline: OnboardingCandidate[] = [
    { id: 1, name: "Rahul Verma", college: "IIT Delhi", role: "SDE Intern", stage: "Offer Accepted", daysInStage: 2 },
    { id: 2, name: "Sanya Gupta", college: "BITS Pilani", role: "Product Manager", stage: "Documents Submitted", daysInStage: 5 },
    { id: 3, name: "Karan Joshi", college: "NIT Trichy", role: "Data Scientist", stage: "Joining Confirmed", daysInStage: 8 },
    { id: 4, name: "Meera Shah", college: "IIIT Hyderabad", role: "ML Engineer", stage: "Offer Sent", daysInStage: 1 },
    { id: 5, name: "Arjun Patel", college: "VIT Vellore", role: "Backend Developer", stage: "Day 1", daysInStage: 0 },
    { id: 6, name: "Divya Menon", college: "Anna University", role: "Frontend Developer", stage: "30-Day Check-in", daysInStage: 2 },
  ];

  const examplePrompts = [
    "Supply chain inefficiency in logistics",
    "Rural healthcare access challenges",
    "Financial literacy for tier-2 students",
    "Last-mile delivery optimization",
  ];

  const renderHome = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex justify-end gap-3">
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
          <Plus className="w-5 h-5" />
          Post a Job
        </button>
        <button
          onClick={() => setCurrentView("talent-search")}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          <Search className="w-5 h-5" />
          Search Talent
        </button>
        <button
          onClick={() => setCurrentView("college-connect")}
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
            <span>+12% from last week</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div className="text-4xl font-bold text-white mb-2">{activeDrives.length}</div>
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
                onClick={() => setSelectedStudent(student.id)}
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
                <select className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                  <option>All Domains</option>
                  <option>AI/ML</option>
                  <option>HealthTech</option>
                  <option>AgriTech</option>
                  <option>EdTech</option>
                  <option>FinTech</option>
                  <option>CleanTech</option>
                  <option>IoT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">College</label>
                <select className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                  <option>All Colleges</option>
                  <option>IIT Delhi</option>
                  <option>BITS Pilani</option>
                  <option>NIT Trichy</option>
                  <option>IIIT Hyderabad</option>
                  <option>VIT Vellore</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Graduation Year</label>
                <select className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                  <option>Any Year</option>
                  <option>2025</option>
                  <option>2026</option>
                  <option>2027</option>
                  <option>2028</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-3">Innovation Score</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="70"
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0</span>
                  <span>70+</span>
                  <span>100</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Patent Status</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600" />
                    <span className="text-sm text-slate-300">Filed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600" />
                    <span className="text-sm text-slate-300">Granted</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Availability</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600" defaultChecked />
                    <span className="text-sm text-slate-300">Internship</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600" defaultChecked />
                    <span className="text-sm text-slate-300">Full-time</span>
                  </label>
                </div>
              </div>
              <button className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">
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
                    onClick={() => setSelectedStudent(student.id)}
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

              <div className="text-center">
                <p className="text-sm text-slate-400 mb-4">Or try an example:</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {examplePrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setProblemQuery(prompt)}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all border border-slate-700 hover:border-purple-500/50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Students with matching projects</h3>
                  <p className="text-sm text-slate-400">Found {newMatches.slice(0, 2).length} students who've worked on similar problems</p>
                </div>
                <button
                  onClick={() => setHasSearched(false)}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Search
                </button>
              </div>
              {newMatches.slice(0, 2).map((student) => (
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
                    onClick={() => setSelectedStudent(student.id)}
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
    const student = newMatches.find((s) => s.id === selectedStudent);
    if (!student) return null;

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
            <button className="px-5 py-2 border-2 border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition-all flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button className="px-5 py-2 border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg font-semibold transition-all">
              Shortlist
            </button>
            <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30">
              <MessageSquare className="w-5 h-5" />
              Message
            </button>
          </div>
        </div>

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

  const renderCollegeConnect = () => (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search institutions by name, city, or state..."
          className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>

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
        {colleges.map((college) => (
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
                <div className="text-lg font-bold text-white">A+</div>
                <div className="text-xs text-slate-400">Rating</div>
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
              <button className="px-4 py-2 border-2 border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg font-semibold text-sm transition-all">
                Request Partnership
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

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">Drive Title</label>
                <input
                  type="text"
                  placeholder="Software Engineering Internship 2026"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Eligible Branches (Multi-select)</label>
                <select
                  multiple
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
                    type="number"
                    step="0.1"
                    placeholder="7.5"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Graduation Year</label>
                  <select className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500">
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
                  placeholder="10"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Role Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Application Deadline</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all shadow-lg shadow-blue-500/30"
              >
                Submit Campus Drive
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

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
              <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all">
                Export Report
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all">
                Edit Drive
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-white mb-2">{activeDrives[selectedDrive - 1]?.name}</h3>
            <p className="text-slate-400 mb-4">{activeDrives[selectedDrive - 1]?.college}</p>
            
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{activeDrives[selectedDrive - 1]?.applications}</div>
                <div className="text-xs text-slate-400">Applications</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{activeDrives[selectedDrive - 1]?.shortlisted}</div>
                <div className="text-xs text-slate-400">Shortlisted</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{activeDrives[selectedDrive - 1]?.interviewed}</div>
                <div className="text-xs text-slate-400">Interviewed</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">{activeDrives[selectedDrive - 1]?.offered}</div>
                <div className="text-xs text-slate-400">Offered</div>
              </div>
              <div className="text-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-2xl font-bold text-white">2</div>
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
            onClick={() => setCurrentView("college-connect")}
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
                              className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                              title="Send Reminder"
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
      {/* Header */}
      {!selectedStudent && (
        <>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {currentView === "home" && "Recruiter Dashboard"}
              {currentView === "talent-search" && "Talent Search"}
              {currentView === "college-connect" && "College Connect"}
              {currentView === "active-drives" && "Active Drives"}
              {currentView === "onboarding" && "Onboarding Tracker"}
            </h1>
            <p className="text-slate-400">
              {currentView === "home" && "Your hiring command center"}
              {currentView === "talent-search" && "Find the perfect talent for your team"}
              {currentView === "college-connect" && "Partner with top institutions"}
              {currentView === "active-drives" && "Manage your campus recruitment drives"}
              {currentView === "onboarding" && "Track new hire onboarding progress"}
            </p>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
            <button
              onClick={() => setCurrentView("home")}
              className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
                currentView === "home"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView("talent-search")}
              className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
                currentView === "talent-search"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Talent Search
            </button>
            <button
              onClick={() => setCurrentView("college-connect")}
              className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
                currentView === "college-connect"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              College Connect
            </button>
            <button
              onClick={() => setCurrentView("active-drives")}
              className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
                currentView === "active-drives"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Active Drives
            </button>
            <button
              onClick={() => setCurrentView("onboarding")}
              className={`px-6 py-3 font-semibold transition-all whitespace-nowrap ${
                currentView === "onboarding"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Onboarding Tracker
            </button>
          </div>
        </>
      )}

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
    </div>
  );
}
