import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Filter, TrendingUp, Users, Award, FileText,
  MapPin, Building2, Star, CheckCircle, Eye, Heart,
  Calendar, ArrowRight, ChevronDown, X, Briefcase,
  Target, Lightbulb, MessageSquare, Shield, Clock, BadgeCheck
} from "lucide-react";
import { investorApi } from '../../../api/investor.api';
import type { InvestorStartupCard } from '../../../types/investor.types';

type ViewType = "dealflow" | "startups" | "institutions" | "portfolio";
type StageType = "Ideation" | "Prototype" | "MVP" | "Launch-Ready";

interface Startup {
  id: number;
  name: string;
  problem: string;
  domain: string;
  college: string;
  teamSize: number;
  stage: StageType;
  innovationScore: number;
  patentStatus: "Filed" | "Granted" | "None";
  location: string;
  seeking: string[];
  team: Array<{ name: string; role: string; score: number; college: string }>;
  timeline: Array<{ date: string; milestone: string; status: string }>;
  mentorBacking: string[];
  portfolio: Array<{ name: string; domain: string; status: string }>;
}

interface Institution {
  id: number;
  name: string;
  city: string;
  state: string;
  naacGrade: string;
  iicStars: number;
  nirfRank: number | null;
  studentsOnProMove: number;
  activeProjects: number;
  patentsFiled: number;
}

export function InvestorDashboard() {
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState<ViewType>("dealflow");
  const [selectedStartup, setSelectedStartup] = useState<number | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<number | null>(null);
  const [filterDomain, setFilterDomain] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [apiStartups, setApiStartups] = useState<InvestorStartupCard[]>([]);
  const [loadingStartups, setLoadingStartups] = useState(false);
  const [expressInterestTarget, setExpressInterestTarget] = useState<InvestorStartupCard | null>(null);
  const [eiType, setEiType] = useState<'penny' | 'sole'>('penny');
  const [eiAmount, setEiAmount] = useState(20000);
  const [eiEquity, setEiEquity] = useState(5);
  const [eiRole, setEiRole] = useState<'shareholder' | 'director' | 'observer' | ''>('');
  const [eiSubmitting, setEiSubmitting] = useState(false);
  const [eiDone, setEiDone] = useState(false);
  const [eiError, setEiError] = useState('');

  // Sync view from URL query param so sidebar links work
  useEffect(() => {
    const viewParam = searchParams.get("view") as ViewType | null;
    if (viewParam && ["dealflow", "startups", "institutions", "portfolio"].includes(viewParam)) {
      setCurrentView(viewParam);
      setSelectedStartup(null);
      setSelectedInstitution(null);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoadingStartups(true);
    investorApi.getStartups({ limit: 50 })
      .then((res) => setApiStartups(res.items))
      .catch(() => {}) // silently fall back to mock data
      .finally(() => setLoadingStartups(false));
  }, []);

  const handleExpressInterest = async () => {
    if (!expressInterestTarget) return;
    setEiSubmitting(true);
    setEiError('');
    try {
      await investorApi.expressInterest(expressInterestTarget._id, {
        investorType: eiType,
        proposedAmountINR: eiAmount,
        proposedEquityPercent: eiEquity,
        ...(eiRole ? { chosenRole: eiRole as 'shareholder' | 'director' | 'observer' } : {}),
      });
      setEiDone(true);
    } catch (err: any) {
      setEiError(err?.response?.data?.message || 'Failed to express interest. Please try again.');
    } finally {
      setEiSubmitting(false);
    }
  };

  const openExpressInterest = (startup: InvestorStartupCard) => {
    setExpressInterestTarget(startup);
    setEiType('penny');
    setEiAmount(20000);
    setEiEquity(5);
    setEiRole('');
    setEiDone(false);
    setEiError('');
  };

  const startups: Startup[] = [
    {
      id: 1,
      name: "AgriSense IoT",
      problem: "70% of Indian farmers lack real-time soil health monitoring leading to crop failure",
      domain: "AgriTech",
      college: "IIT Delhi",
      teamSize: 4,
      stage: "MVP",
      innovationScore: 94,
      patentStatus: "Filed",
      location: "Delhi",
      seeking: ["Funding", "Industry Connections"],
      team: [
        { name: "Sarah Chen", role: "Founder & Tech Lead", score: 94, college: "IIT Delhi" },
        { name: "Arjun Mehta", role: "Co-founder", score: 88, college: "IIT Delhi" },
        { name: "Priya Sharma", role: "Hardware Engineer", score: 86, college: "IIT Delhi" },
      ],
      timeline: [
        { date: "Feb 2026", milestone: "MVP Development Completed", status: "completed" },
        { date: "Jan 2026", milestone: "Pilot Testing with 50 Farmers", status: "completed" },
        { date: "Dec 2025", milestone: "Patent Application Filed", status: "completed" },
        { date: "Nov 2025", milestone: "Prototype Built", status: "completed" },
      ],
      mentorBacking: ["Dr. Rajesh Kumar (IIT-D Professor)", "Sandeep Gupta (Ex-CEO, FarmTech)"],
      portfolio: [
        { name: "Smart Irrigation Controller", domain: "AgriTech", status: "Deployed" },
        { name: "Crop Disease Detector", domain: "AI/ML", status: "Active" },
      ],
    },
    {
      id: 2,
      name: "EduBridge AI",
      problem: "Students in tier-2 cities lack personalized learning support",
      domain: "EdTech",
      college: "BITS Pilani",
      teamSize: 3,
      stage: "Launch-Ready",
      innovationScore: 89,
      patentStatus: "None",
      location: "Rajasthan",
      seeking: ["Funding", "Mentorship"],
      team: [
        { name: "Rajesh Kumar", role: "Founder", score: 89, college: "BITS Pilani" },
        { name: "Neha Desai", role: "AI Engineer", score: 85, college: "BITS Pilani" },
      ],
      timeline: [
        { date: "Mar 2026", milestone: "Beta Launch with 500 Students", status: "in-progress" },
        { date: "Feb 2026", milestone: "Platform Development Complete", status: "completed" },
        { date: "Jan 2026", milestone: "AI Model Training", status: "completed" },
      ],
      mentorBacking: ["Prof. Anita Singh (BITS Faculty)"],
      portfolio: [
        { name: "Math Tutor Bot", domain: "EdTech", status: "Active" },
      ],
    },
    {
      id: 3,
      name: "HealthTrack Pro",
      problem: "Rural clinics struggle with patient data management and diagnostics",
      domain: "HealthTech",
      college: "Stanford University",
      teamSize: 5,
      stage: "Prototype",
      innovationScore: 86,
      patentStatus: "Granted",
      location: "California",
      seeking: ["Industry Connections", "Pilot Partners"],
      team: [
        { name: "Maria Santos", role: "Founder & CEO", score: 86, college: "Stanford" },
        { name: "David Chen", role: "CTO", score: 82, college: "Stanford" },
      ],
      timeline: [
        { date: "Mar 2026", milestone: "Clinical Trials Ongoing", status: "in-progress" },
        { date: "Feb 2026", milestone: "Patent Granted", status: "completed" },
        { date: "Dec 2025", milestone: "Prototype Development", status: "completed" },
      ],
      mentorBacking: ["Dr. Jennifer Lee (Stanford Medical)", "Mark Thompson (HealthTech Investor)"],
      portfolio: [
        { name: "Telemedicine Platform", domain: "HealthTech", status: "Active" },
        { name: "Diagnostic Assistant AI", domain: "AI/ML", status: "Development" },
      ],
    },
    {
      id: 4,
      name: "GreenEnergy Hub",
      problem: "Decentralized renewable energy storage is inefficient and costly",
      domain: "CleanTech",
      college: "MIT",
      teamSize: 4,
      stage: "Ideation",
      innovationScore: 79,
      patentStatus: "Filed",
      location: "Massachusetts",
      seeking: ["Mentorship", "R&D Support"],
      team: [
        { name: "Emma Wilson", role: "Founder", score: 79, college: "MIT" },
      ],
      timeline: [
        { date: "Mar 2026", milestone: "Market Research Complete", status: "in-progress" },
        { date: "Feb 2026", milestone: "Concept Validation", status: "completed" },
      ],
      mentorBacking: ["Prof. Alan Green (MIT Energy Lab)"],
      portfolio: [],
    },
  ];

  const institutions: Institution[] = [
    {
      id: 1,
      name: "IIT Delhi",
      city: "New Delhi",
      state: "Delhi",
      naacGrade: "A++",
      iicStars: 5,
      nirfRank: 2,
      studentsOnProMove: 312,
      activeProjects: 89,
      patentsFiled: 24,
    },
    {
      id: 2,
      name: "BITS Pilani",
      city: "Pilani",
      state: "Rajasthan",
      naacGrade: "A++",
      iicStars: 4,
      nirfRank: 23,
      studentsOnProMove: 248,
      activeProjects: 67,
      patentsFiled: 18,
    },
    {
      id: 3,
      name: "Stanford University",
      city: "Stanford",
      state: "California",
      naacGrade: "A++",
      iicStars: 5,
      nirfRank: null,
      studentsOnProMove: 186,
      activeProjects: 52,
      patentsFiled: 31,
    },
    {
      id: 4,
      name: "MIT",
      city: "Cambridge",
      state: "Massachusetts",
      naacGrade: "A++",
      iicStars: 5,
      nirfRank: null,
      studentsOnProMove: 204,
      activeProjects: 61,
      patentsFiled: 28,
    },
  ];

  const backedStartups = [
    { id: 1, name: "AgriSense IoT", stage: "MVP", lastUpdate: "2 days ago", domain: "AgriTech", progress: 75 },
    { id: 2, name: "EduBridge AI", stage: "Launch-Ready", lastUpdate: "5 hours ago", domain: "EdTech", progress: 90 },
  ];

  const partneredInstitutions = [
    { id: 1, name: "IIT Delhi", partnershipType: "Innovation Partner", since: "Jan 2026" },
    { id: 2, name: "BITS Pilani", partnershipType: "Incubation Support", since: "Feb 2026" },
  ];

  const portfolioActivity = [
    { type: "startup", entity: "AgriSense IoT", action: "completed pilot testing with 50 farmers", time: "2 days ago" },
    { type: "startup", entity: "EduBridge AI", action: "onboarded 500 beta users", time: "5 hours ago" },
    { type: "institution", entity: "IIT Delhi", action: "launched new innovation challenge", time: "1 week ago" },
    { type: "institution", entity: "BITS Pilani", action: "filed 3 new patents", time: "2 weeks ago" },
  ];

  const filteredStartups = startups.filter((startup) => {
    const matchesDomain = filterDomain === "All" || startup.domain === filterDomain;
    const matchesStage = filterStage === "All" || startup.stage === filterStage;
    const matchesLocation = filterLocation === "All" || startup.location === filterLocation;
    return matchesDomain && matchesStage && matchesLocation;
  });

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderDealFlow = () => (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">Filters:</span>
          </div>
          
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option>All Domains</option>
            <option>AgriTech</option>
            <option>EdTech</option>
            <option>HealthTech</option>
            <option>CleanTech</option>
            <option>FinTech</option>
          </select>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option>All Stages</option>
            <option>Ideation</option>
            <option>Prototype</option>
            <option>MVP</option>
            <option>Launch-Ready</option>
          </select>

          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option>All Locations</option>
            <option>Delhi</option>
            <option>Rajasthan</option>
            <option>California</option>
            <option>Massachusetts</option>
          </select>

          <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option>Innovation Score: All</option>
            <option>90+</option>
            <option>80-89</option>
            <option>70-79</option>
          </select>

          {(filterDomain !== "All" || filterStage !== "All" || filterLocation !== "All") && (
            <button
              onClick={() => {
                setFilterDomain("All");
                setFilterStage("All");
                setFilterLocation("All");
              }}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Startup Cards */}
      <div className="grid gap-6">
        {loadingStartups ? (
          <div className="text-center py-12 text-slate-400">Loading startups from server...</div>
        ) : apiStartups.length > 0 ? apiStartups.map((startup) => (
          <div
            key={startup._id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{startup.name}</h3>
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold">
                    {startup.category}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    startup.stage === "launch-ready" ? "bg-green-500/10 text-green-400" :
                    startup.stage === "mvp" ? "bg-blue-500/10 text-blue-400" :
                    startup.stage === "prototype" ? "bg-purple-500/10 text-purple-400" :
                    "bg-slate-700 text-slate-300"
                  }`}>
                    {startup.stage}
                  </span>
                </div>
                <p className="text-slate-300 text-lg mb-4">{startup.tagline}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-4 py-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Innovation Score</div>
                  <div className="text-2xl font-bold text-white text-center">{startup.innovationScoreAtLaunch}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span className="text-sm">{startup.teamSize} members</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Award className="w-4 h-4" />
                <span className="text-sm">{startup.sharePool.availableShares} shares available</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">
                  {[startup.acceptsPennyInvestors && 'Penny', startup.acceptsSoleInvestor && 'Sole'].filter(Boolean).join(' & ') || 'Closed'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {startup.traction.patentFiled ? (
                  <>
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">Patent Filed</span>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">No Patent</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex gap-2 flex-wrap">
                {startup.traction.mvpBuilt && (
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">MVP Built</span>
                )}
                {startup.traction.revenueGenerating && (
                  <span className="px-3 py-1 bg-green-500/10 rounded-full text-xs text-green-400">Revenue Generating</span>
                )}
                {startup.founder?.displayName && (
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400">
                    by {startup.founder.displayName}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                {startup.pitchDeckUrl ? (
                  <a
                    href={startup.pitchDeckUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Pitch
                  </a>
                ) : (
                  <button
                    disabled
                    className="px-6 py-2 bg-blue-600/40 text-white/50 rounded-lg font-semibold text-sm flex items-center gap-2 cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    No Pitch Deck
                  </button>
                )}
                <button
                  onClick={() => openExpressInterest(startup)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  Express Interest
                </button>
              </div>
            </div>
          </div>
        )) : filteredStartups.map((startup) => (
          <div
            key={startup.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{startup.name}</h3>
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold">
                    {startup.domain}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    startup.stage === "Launch-Ready" ? "bg-green-500/10 text-green-400" :
                    startup.stage === "MVP" ? "bg-blue-500/10 text-blue-400" :
                    startup.stage === "Prototype" ? "bg-purple-500/10 text-purple-400" :
                    "bg-slate-700 text-slate-300"
                  }`}>
                    {startup.stage}
                  </span>
                </div>
                <p className="text-slate-300 text-lg mb-4">{startup.problem}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-4 py-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Innovation Score</div>
                  <div className="text-2xl font-bold text-white text-center">{startup.innovationScore}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">{startup.college}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span className="text-sm">{startup.teamSize} members</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{startup.location}</span>
              </div>
              <div className="flex items-center gap-2">
                {startup.patentStatus === "Granted" ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Patent Granted</span>
                  </>
                ) : startup.patentStatus === "Filed" ? (
                  <>
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">Patent Filed</span>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">No Patent</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex gap-2">
                {startup.seeking.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                    Seeking: {item}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedStartup(startup.id)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Pitch
                </button>
                <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Express Interest
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStartupDetail = () => {
    const startup = startups.find((s) => s.id === selectedStartup);
    if (!startup) return null;

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedStartup(null)}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          ← Back to Deal Flow
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-bold text-white">{startup.name}</h1>
                <span className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-semibold">
                  {startup.domain}
                </span>
              </div>
              <p className="text-xl text-slate-300 mb-4">{startup.problem}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Building2 className="w-5 h-5" />
                  <span>{startup.college}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-5 h-5" />
                  <span>{startup.location}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-5 h-5" />
                  <span>{startup.teamSize} team members</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="px-6 py-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/30 rounded-xl mb-4">
                <div className="text-sm text-slate-400 mb-1">Innovation Score</div>
                <div className="text-4xl font-bold text-white">{startup.innovationScore}</div>
              </div>
              <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2">
                <Heart className="w-5 h-5" />
                Express Interest
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* The Team */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              The Team
            </h2>
            <div className="space-y-4">
              {startup.team.map((member, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{member.name.split(" ").map(n => n[0]).join("")}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{member.name}</h3>
                      <p className="text-sm text-slate-400">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{member.score}</div>
                      <div className="text-xs text-slate-400">Score</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-green-500" />
              Progress Timeline
            </h2>
            <div className="space-y-4">
              {startup.timeline.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.status === "completed" ? "bg-green-500/10" : "bg-yellow-500/10"
                  }`}>
                    {item.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{item.milestone}</p>
                    <p className="text-sm text-slate-400">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-purple-500" />
              Past Projects Portfolio
            </h2>
            {startup.portfolio.length > 0 ? (
              <div className="space-y-3">
                {startup.portfolio.map((project, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white">{project.name}</h3>
                        <p className="text-sm text-slate-400">{project.domain}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        project.status === "Deployed" ? "bg-green-500/10 text-green-400" :
                        project.status === "Active" ? "bg-blue-500/10 text-blue-400" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No past projects listed</p>
            )}
          </div>

          {/* Mentor Backing & Patent Status */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-orange-500" />
                Mentor Backing
              </h2>
              <div className="space-y-2">
                {startup.mentorBacking.map((mentor, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-300">
                    <BadgeCheck className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">{mentor}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-yellow-500" />
                Patent Status
              </h2>
              <div className={`p-4 rounded-lg border ${
                startup.patentStatus === "Granted" ? "bg-green-500/10 border-green-500/30" :
                startup.patentStatus === "Filed" ? "bg-yellow-500/10 border-yellow-500/30" :
                "bg-slate-800 border-slate-700"
              }`}>
                <div className="flex items-center gap-3">
                  {startup.patentStatus === "Granted" ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : startup.patentStatus === "Filed" ? (
                    <Clock className="w-6 h-6 text-yellow-400" />
                  ) : (
                    <X className="w-6 h-6 text-slate-500" />
                  )}
                  <div>
                    <p className={`font-bold ${
                      startup.patentStatus === "Granted" ? "text-green-400" :
                      startup.patentStatus === "Filed" ? "text-yellow-400" :
                      "text-slate-400"
                    }`}>
                      {startup.patentStatus === "None" ? "No Patent Filed" : `Patent ${startup.patentStatus}`}
                    </p>
                    {startup.patentStatus !== "None" && (
                      <p className="text-sm text-slate-400">Application under review</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">What They're Seeking</h2>
              <div className="flex flex-wrap gap-2">
                {startup.seeking.map((item, i) => (
                  <span key={i} className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInstitutions = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search institutions by name, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Institution Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredInstitutions.map((institution) => (
          <div
            key={institution.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{institution.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span>{institution.city}, {institution.state}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-semibold text-center">
                  NAAC {institution.naacGrade}
                </span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < institution.iicStars ? "text-yellow-500 fill-yellow-500" : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {institution.nirfRank && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="text-xs text-blue-400 mb-1">NIRF Ranking</div>
                <div className="text-2xl font-bold text-white">#{institution.nirfRank}</div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">{institution.studentsOnProMove}</div>
                <div className="text-xs text-slate-400">Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">{institution.activeProjects}</div>
                <div className="text-xs text-slate-400">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-1">{institution.patentsFiled}</div>
                <div className="text-xs text-slate-400">Patents</div>
              </div>
            </div>

            <button
              onClick={() => setSelectedInstitution(institution.id)}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Briefcase className="w-5 h-5" />
              Partner with Institution
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInstitutionDetail = () => {
    const institution = institutions.find((inst) => inst.id === selectedInstitution);
    if (!institution) return null;

    // Get startups from this institution
    const institutionStartups = startups.filter((s) => s.college === institution.name);

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedInstitution(null)}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
        >
          ← Back to Institutions
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-bold text-white">{institution.name}</h1>
                <span className="px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-sm font-semibold">
                  NAAC {institution.naacGrade}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-5 h-5" />
                  <span>{institution.city}, {institution.state}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < institution.iicStars ? "text-yellow-500 fill-yellow-500" : "text-slate-600"
                      }`}
                    />
                  ))}
                  <span className="text-sm text-slate-400 ml-2">IIC Rating</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              {institution.nirfRank && (
                <div className="px-6 py-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/30 rounded-xl mb-4">
                  <div className="text-sm text-slate-400 mb-1">NIRF Ranking</div>
                  <div className="text-4xl font-bold text-white">#{institution.nirfRank}</div>
                </div>
              )}
              <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2">
                <Briefcase className="w-5 h-5" />
                Request Partnership
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{institution.studentsOnProMove}</div>
            <div className="text-sm text-slate-400">Students on ProMove</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-green-500/10 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{institution.activeProjects}</div>
            <div className="text-sm text-slate-400">Active Projects</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{institution.patentsFiled}</div>
            <div className="text-sm text-slate-400">Patents Filed</div>
          </div>
        </div>

        {/* Startups from this Institution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-purple-500" />
            Startups from {institution.name}
          </h2>
          {institutionStartups.length > 0 ? (
            <div className="space-y-4">
              {institutionStartups.map((startup) => (
                <div
                  key={startup.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white">{startup.name}</h3>
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold">
                          {startup.domain}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          startup.stage === "Launch-Ready" ? "bg-green-500/10 text-green-400" :
                          startup.stage === "MVP" ? "bg-blue-500/10 text-blue-400" :
                          startup.stage === "Prototype" ? "bg-purple-500/10 text-purple-400" :
                          "bg-slate-700 text-slate-300"
                        }`}>
                          {startup.stage}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{startup.problem}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="px-4 py-2 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg text-center">
                        <div className="text-xs text-slate-400">Score</div>
                        <div className="text-xl font-bold text-white">{startup.innovationScore}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedInstitution(null);
                          setSelectedStartup(startup.id);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Pitch
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm py-4">No startups listed from this institution yet.</p>
          )}
        </div>

        {/* Partnership Benefits */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-cyan-500" />
            Partnership Benefits
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Early Deal Flow Access</h3>
              </div>
              <p className="text-sm text-slate-400">Get first access to high-potential startups emerging from this institution's innovation ecosystem.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Innovation Lab Collaboration</h3>
              </div>
              <p className="text-sm text-slate-400">Partner with research labs to co-develop solutions and validate technologies before market entry.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Talent Pipeline</h3>
              </div>
              <p className="text-sm text-slate-400">Access top-tier student innovators for mentorship programs and potential portfolio company hires.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Patent Co-Ownership</h3>
              </div>
              <p className="text-sm text-slate-400">Explore joint IP development opportunities and patent co-ownership for breakthrough innovations.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPortfolio = () => (
    <div className="space-y-6">
      {/* Backed Startups */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-500" />
          Startups I've Backed
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {backedStartups.map((startup) => (
            <div key={startup.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white mb-1">{startup.name}</h3>
                  <p className="text-sm text-slate-400">{startup.domain}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  startup.stage === "Launch-Ready" ? "bg-green-500/10 text-green-400" :
                  "bg-blue-500/10 text-blue-400"
                }`}>
                  {startup.stage}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progress</span>
                  <span>{startup.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{ width: `${startup.progress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Last update: {startup.lastUpdate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Partnered Institutions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500" />
          Institutions I've Partnered With
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {partneredInstitutions.map((inst) => (
            <div key={inst.id} className="bg-slate-950 border border-slate-800 rounded-lg p-5">
              <h3 className="font-bold text-white mb-2">{inst.name}</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-400">{inst.partnershipType}</p>
                  <p className="text-xs text-slate-500">Since {inst.since}</p>
                </div>
                <button className="text-sm text-blue-400 hover:text-blue-300">View Details →</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Recent Updates</h2>
        <div className="space-y-4">
          {portfolioActivity.map((activity, i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-slate-800 last:border-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === "startup" ? "bg-green-500/10" : "bg-blue-500/10"
              }`}>
                {activity.type === "startup" ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white mb-1">
                  <span className="font-semibold">{activity.entity}</span>{" "}
                  <span className="text-slate-400">{activity.action}</span>
                </p>
                <p className="text-xs text-slate-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      {!selectedStartup && !selectedInstitution && (
        <>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {currentView === "dealflow" && "Deal Flow"}
              {currentView === "startups" && "Startup Explorer"}
              {currentView === "institutions" && "Institutions"}
              {currentView === "portfolio" && "My Portfolio"}
            </h1>
            <p className="text-slate-400">
              {currentView === "dealflow" && "Discover high-potential student-led startups"}
              {currentView === "startups" && "Explore innovative startup opportunities"}
              {currentView === "institutions" && "Partner with leading innovation institutions"}
              {currentView === "portfolio" && "Track your investments and partnerships"}
            </p>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 border-b border-slate-800">
            <button
              onClick={() => setCurrentView("dealflow")}
              className={`px-6 py-3 font-semibold transition-all ${
                currentView === "dealflow"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Deal Flow
            </button>
            <button
              onClick={() => setCurrentView("startups")}
              className={`px-6 py-3 font-semibold transition-all ${
                currentView === "startups"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Startups
            </button>
            <button
              onClick={() => setCurrentView("institutions")}
              className={`px-6 py-3 font-semibold transition-all ${
                currentView === "institutions"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Institutions
            </button>
            <button
              onClick={() => setCurrentView("portfolio")}
              className={`px-6 py-3 font-semibold transition-all ${
                currentView === "portfolio"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              My Portfolio
            </button>
          </div>
        </>
      )}

      {/* Content */}
      {selectedStartup ? (
        renderStartupDetail()
      ) : selectedInstitution ? (
        renderInstitutionDetail()
      ) : currentView === "dealflow" || currentView === "startups" ? (
        renderDealFlow()
      ) : currentView === "institutions" ? (
        renderInstitutions()
      ) : (
        renderPortfolio()
      )}

      {/* Express Interest Modal */}
      {expressInterestTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-lg">
            {eiDone ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Interest Expressed!</h2>
                <p className="text-slate-300">
                  Your interest in{' '}
                  <span className="text-white font-semibold">{expressInterestTarget.name}</span>{' '}
                  has been submitted.
                </p>
                <div className="bg-slate-800 rounded-xl p-4 text-left space-y-2">
                  <p className="text-sm font-semibold text-blue-400">What happens next?</p>
                  <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                    <li>The student founder is notified of your interest</li>
                    <li>A deal is created and appears in your Deal Flow</li>
                    <li>The student can accept and initiate contact through the platform</li>
                    <li>Track progress under My Portfolio once the deal advances</li>
                  </ul>
                </div>
                <button
                  onClick={() => setExpressInterestTarget(null)}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Express Interest</h2>
                  <button onClick={() => setExpressInterestTarget(null)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-slate-400 mb-6">
                  You are expressing interest in{' '}
                  <span className="text-white font-semibold">{expressInterestTarget.name}</span>
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Investor Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEiType('penny')}
                        className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
                          eiType === 'penny'
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        Penny Investor
                        {!expressInterestTarget.acceptsPennyInvestors && (
                          <span className="block text-xs text-red-400 mt-1">Not accepting</span>
                        )}
                      </button>
                      <button
                        onClick={() => setEiType('sole')}
                        className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
                          eiType === 'sole'
                            ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        Sole Investor
                        {!expressInterestTarget.acceptsSoleInvestor && (
                          <span className="block text-xs text-red-400 mt-1">Not accepting</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Proposed Amount (INR){' '}
                      <span className="text-slate-500 font-normal">min ₹20,000</span>
                    </label>
                    <input
                      type="number"
                      min={20000}
                      value={eiAmount}
                      onChange={(e) => setEiAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Proposed Equity %{' '}
                      <span className="text-slate-500 font-normal">0.01 – 100</span>
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      value={eiEquity}
                      onChange={(e) => setEiEquity(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Your Role{' '}
                      <span className="text-slate-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={eiRole}
                      onChange={(e) => setEiRole(e.target.value as 'shareholder' | 'director' | 'observer' | '')}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select a role</option>
                      <option value="shareholder">Shareholder</option>
                      <option value="director">Director</option>
                      <option value="observer">Observer</option>
                    </select>
                  </div>

                  {eiError && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                      {eiError}
                    </p>
                  )}

                  <button
                    onClick={handleExpressInterest}
                    disabled={eiSubmitting}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Heart className="w-5 h-5" />
                    {eiSubmitting ? 'Submitting...' : 'Express Interest'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
