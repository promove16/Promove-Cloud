import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search, ShoppingCart } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { marketplaceApi } from "../../api/marketplace.api";

const tabs = [
  { id: "mentor", label: "Mentors" },
  { id: "investor", label: "Investors" },
  { id: "recruiter", label: "Recruiters" },
] as const;

export function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const role = (searchParams.get("role") as "mentor" | "investor" | "recruiter" | null) ?? "mentor";
  const domain = searchParams.get("domain") ?? "";

  const listQuery = useQuery({
    queryKey: ["marketplace", role, domain],
    queryFn: () => marketplaceApi.list(role, { domain: domain || undefined }),
  });

  const profileQuery = useQuery({
    queryKey: ["marketplace", "profile", selectedProfile],
    queryFn: () => marketplaceApi.getProfile(selectedProfile!),
    enabled: Boolean(selectedProfile),
  });

  const profiles = useMemo(
    () =>
      (listQuery.data ?? []).filter((profile) =>
        domain ? `${profile.displayName} ${profile.domain ?? ""} ${profile.bio ?? ""}`.toLowerCase().includes(domain.toLowerCase()) : true,
      ),
    [domain, listQuery.data],
  );

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
            <p className="text-slate-400">Browse mentors, investors, and recruiters connected to your innovation path</p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Connections Coming Soon
          </button>
        </div>

        <div className="grid lg:grid-cols-[240px,1fr] gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-fit">
            <div className="space-y-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSearchParams({ role: tab.id, ...(domain ? { domain } : {}) })}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold ${
                    role === tab.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Domain filter</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={domain}
                  onChange={(event) => setSearchParams({ role, ...(event.target.value ? { domain: event.target.value } : {}) })}
                  placeholder="AgriTech, AI, Health"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {profiles.map((profile) => (
              <div key={profile._id} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {profile.avatar ? <img src={profile.avatar} alt={profile.displayName} className="w-14 h-14 rounded-full object-cover" /> : profile.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{profile.displayName}</h3>
                      <div className="text-sm text-blue-300 capitalize mb-2">{profile.role}</div>
                      <div className="text-sm text-slate-400 mb-2">{profile.domain ?? "General innovation support"}</div>
                      <p className="text-sm text-slate-300 max-w-2xl">{profile.bio ?? "Public profile details will appear here as more marketplace members complete their profiles."}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedProfile(profile._id)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      View Profile
                    </button>
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold opacity-80">
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedProfile && profileQuery.data ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">{profileQuery.data.displayName}</h2>
                  <p className="text-slate-400 capitalize">{profileQuery.data.role} • {profileQuery.data.domain ?? "General"}</p>
                </div>
                <button onClick={() => setSelectedProfile(null)} className="text-slate-400 hover:text-white">Close</button>
              </div>
              <p className="text-slate-300 leading-7 mb-6">{profileQuery.data.bio ?? "This profile is available in the marketplace and can be used for future connection workflows."}</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedProfile(null)} className="px-5 py-3 bg-slate-800 text-white rounded-lg font-semibold">Close</button>
                <button className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold opacity-80">Connect Coming Soon</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
