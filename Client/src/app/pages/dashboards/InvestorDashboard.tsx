import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  TrendingUp, Users, Award, Building2, Star, Eye, Heart,
  Briefcase, Rocket, Handshake, Activity, FileText, CheckCircle,
  Clock, ArrowRight
} from "lucide-react";
import { investorApi } from '../../../api/investor.api';
import type { InvestorStartupCard } from '../../../types/investor.types';

type ViewType = "dashboard" | "portfolio" | "institutions" | "explore";

export function InvestorDashboard() {
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [apiStartups, setApiStartups] = useState<InvestorStartupCard[]>([]);
  const [loadingStartups, setLoadingStartups] = useState(true);
  const [expressInterestTarget, setExpressInterestTarget] = useState<InvestorStartupCard | null>(null);
  const [eiType, setEiType] = useState<'penny' | 'sole'>('penny');
  const [eiAmount, setEiAmount] = useState(20000);
  const [eiEquity, setEiEquity] = useState(5);
  const [eiRole, setEiRole] = useState<'shareholder' | 'director' | 'observer' | ''>('');
  const [eiSubmitting, setEiSubmitting] = useState(false);
  const [eiDone, setEiDone] = useState(false);
  const [eiError, setEiError] = useState('');

  useEffect(() => {
    const viewParam = searchParams.get("view") as ViewType | null;
    if (viewParam && ["dashboard", "portfolio", "institutions", "explore"].includes(viewParam)) {
      setCurrentView(viewParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoadingStartups(true);
    investorApi.getStartups({ limit: 20 })
      .then((res) => setApiStartups(res.items ?? []))
      .catch(() => setApiStartups([]))
      .finally(() => setLoadingStartups(false));
  }, []);

  const portfolioStats = {
    totalInvested: 125000,
    activeStartups: 3,
    pendingDeals: 2,
    portfolioGrowth: 8,
  };

  const portfolioStartups = [
    { id: "1", name: "AgriSense IoT", stage: "MVP", invested: 20000, equity: 5, progress: 75, lastUpdate: "2 days ago" },
    { id: "2", name: "EduBridge AI", stage: "Launch-Ready", invested: 25000, equity: 4, progress: 90, lastUpdate: "1 week ago" },
  ];

  const recentActivity = [
    { id: 1, startup: "AgriSense IoT", action: "Progress update received", time: "2 hours ago", type: "update" },
    { id: 2, startup: "EduBridge AI", action: "New milestone completed", time: "1 day ago", type: "milestone" },
  ];

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
      setEiError(err?.response?.data?.message || 'Failed to express interest.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Investor Dashboard</h1>
        <p className="text-slate-400 mt-1">Track your portfolio and discover new opportunities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-400 font-medium">Total Invested</p>
              <p className="text-2xl font-bold text-white mt-1">₹{portfolioStats.totalInvested.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-400 font-medium">Active Startups</p>
              <p className="text-2xl font-bold text-white mt-1">{portfolioStats.activeStartups}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-400 font-medium">Pending Deals</p>
              <p className="text-2xl font-bold text-white mt-1">{portfolioStats.pendingDeals}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Handshake className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-400 font-medium">Portfolio Growth</p>
              <p className="text-2xl font-bold text-white mt-1">+{portfolioStats.portfolioGrowth}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {currentView === "dashboard" && (
            <>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">My Portfolio</h2>
                  <button onClick={() => setCurrentView("portfolio")} className="text-sm text-blue-400 hover:text-blue-300">
                    View All →
                  </button>
                </div>
                <div className="space-y-4">
                  {portfolioStartups.map((startup) => (
                    <div key={startup.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">{startup.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">{startup.name}</p>
                          <p className="text-sm text-slate-400">{startup.stage} • {startup.lastUpdate}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">₹{startup.invested.toLocaleString()}</p>
                        <p className="text-sm text-slate-400">{startup.equity}% equity</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Recent Activity</h2>
                </div>
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 hover:bg-slate-800/30 rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm text-white">
                          <span className="font-medium">{activity.startup}</span> - {activity.action}
                        </p>
                        <p className="text-xs text-slate-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentView === "portfolio" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">My Investments</h2>
                <button onClick={() => setCurrentView("dashboard")} className="text-sm text-blue-400 hover:text-blue-300">
                  ← Back to Dashboard
                </button>
              </div>
              <div className="space-y-4">
                {portfolioStartups.map((startup) => (
                  <div key={startup.id} className="p-5 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                          <span className="text-xl font-bold text-white">{startup.name.charAt(0)}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{startup.name}</h3>
                          <p className="text-sm text-slate-400">{startup.stage}</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
                        Active
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-xs text-slate-400">Invested</p>
                        <p className="font-semibold text-white">₹{startup.invested.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Equity</p>
                        <p className="font-semibold text-white">{startup.equity}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Progress</p>
                        <p className="font-semibold text-white">{startup.progress}%</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button className="flex-1 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-medium">
                        View Details
                      </button>
                      <button className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-sm font-medium">
                        Contact Founder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === "explore" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Discover Startups</h2>
                <button onClick={() => setCurrentView("dashboard")} className="text-sm text-blue-400 hover:text-blue-300">
                  ← Back to Dashboard
                </button>
              </div>
              <div className="space-y-4">
                {loadingStartups ? (
                  <div className="text-center py-8 text-slate-400">Loading startups...</div>
                ) : apiStartups.length > 0 ? apiStartups.slice(0, 8).map((startup) => (
                  <div key={startup._id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">{startup.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{startup.name}</p>
                        <p className="text-sm text-slate-400">{startup.category} • {startup.stage}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-white">{startup.innovationScoreAtLaunch}</p>
                        <p className="text-xs text-slate-400">Score</p>
                      </div>
                      <button onClick={() => openExpressInterest(startup)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                        Invest
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-400">No startups available</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Navigation</h2>
            <div className="space-y-2">
              <button onClick={() => setCurrentView("dashboard")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${currentView === "dashboard" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-slate-300 hover:bg-slate-800"}`}>
                <Activity className="w-5 h-5" />
                Dashboard
              </button>
              <button onClick={() => setCurrentView("portfolio")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${currentView === "portfolio" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-slate-300 hover:bg-slate-800"}`}>
                <Briefcase className="w-5 h-5" />
                My Portfolio
              </button>
              <button onClick={() => setCurrentView("explore")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${currentView === "explore" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-slate-300 hover:bg-slate-800"}`}>
                <Rocket className="w-5 h-5" />
                Discover Startups
              </button>
              <button onClick={() => setCurrentView("institutions")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-colors ${currentView === "institutions" ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-slate-300 hover:bg-slate-800"}`}>
                <Building2 className="w-5 h-5" />
                Institutions
              </button>
            </div>
          </div>

          {currentView !== "explore" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button onClick={() => setCurrentView("explore")} className="w-full flex items-center gap-3 p-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-blue-400 font-medium transition-colors">
                  <Rocket className="w-5 h-5" />
                  Browse Deal Flow
                </button>
                <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-medium transition-colors">
                  <Star className="w-5 h-5" />
                  My Watchlist
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Portfolio Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active Investments</span>
                <span className="text-white font-semibold">{portfolioStats.activeStartups}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Deployed</span>
                <span className="text-white font-semibold">₹{portfolioStats.totalInvested.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Avg. Deal Size</span>
                <span className="text-white font-semibold">₹{Math.round(portfolioStats.totalInvested / portfolioStats.activeStartups).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Growth</span>
                <span className="text-emerald-400 font-semibold">+{portfolioStats.portfolioGrowth}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expressInterestTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-lg">
            {eiDone ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Interest Expressed!</h3>
                  <p className="text-slate-400 mt-2">The startup team will be notified.</p>
                </div>
                <button onClick={() => setExpressInterestTarget(null)} className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold">
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Express Interest</h3>
                  <button onClick={() => setExpressInterestTarget(null)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>
                <p className="text-slate-400 mb-6">
                  Investing in <span className="text-white font-semibold">{expressInterestTarget.name}</span>
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Investor Type</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEiType('penny')} className={`flex-1 py-3 rounded-lg font-semibold transition-all ${eiType === 'penny' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Penny
                      </button>
                      <button type="button" onClick={() => setEiType('sole')} className={`flex-1 py-3 rounded-lg font-semibold transition-all ${eiType === 'sole' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Sole
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Amount (₹)</label>
                    <input type="number" min={1000} value={eiAmount} onChange={(e) => setEiAmount(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Equity (%)</label>
                    <input type="number" min={0.01} max={100} step={0.01} value={eiEquity} onChange={(e) => setEiEquity(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                  </div>
                  {eiError && <p className="text-red-400 text-sm">{eiError}</p>}
                  <button onClick={handleExpressInterest} disabled={eiSubmitting} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold">
                    {eiSubmitting ? 'Submitting...' : 'Submit Interest'}
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