import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Shield, X } from 'lucide-react';
import { patentApi } from '../../api/patent.api';
import type { ShowcasedPatent } from '../../types/patent.types';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

const INVENTION_CATEGORY_LABELS: Record<string, string> = {
  mobile_app_backend: 'Mobile App / Backend',
  iot_hardware_interface: 'IoT & Hardware',
  mechanical_improvement: 'Mechanical',
  software_hardware_integration: 'Software-Hardware',
  other: 'Other',
};

const SPECIFICATION_TYPE_LABELS: Record<string, string> = {
  provisional: 'Provisional',
  complete: 'Complete',
};

function PatentDetailModal({
  patent,
  onClose,
}: {
  patent: ShowcasedPatent;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-start justify-center">
        <Card className="w-full p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Showcased Patent</div>
              <h3 className="mt-2 text-2xl font-bold text-white">{patent.projectTitle}</h3>
            </div>
            <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {/* Student info */}
            <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-lg font-bold text-white">
                {patent.student.avatar ? (
                  <img src={patent.student.avatar} alt={patent.student.displayName} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  patent.student.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <div className="font-semibold text-white">{patent.student.displayName}</div>
                {patent.student.headline && <div className="text-sm text-slate-400">{patent.student.headline}</div>}
                {patent.student.domain && <div className="mt-0.5 text-xs text-cyan-300">{patent.student.domain}</div>}
                {patent.student.bio && <div className="mt-2 text-sm text-slate-400 line-clamp-3">{patent.student.bio}</div>}
              </div>
            </div>

            {/* Patent details */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {patent.inventionCategory && (
                  <span className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-300">
                    {INVENTION_CATEGORY_LABELS[patent.inventionCategory] ?? patent.inventionCategory}
                  </span>
                )}
                {patent.specificationType && (
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                    {SPECIFICATION_TYPE_LABELS[patent.specificationType] ?? patent.specificationType} Specification
                  </span>
                )}
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                  Approved
                </span>
              </div>

              {patent.abstract && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">Abstract</div>
                  <p className="text-sm leading-7 text-slate-300">{patent.abstract}</p>
                </div>
              )}

              <div className="text-xs text-slate-500">
                Approved {patent.adminReviewedAt ? new Date(patent.adminReviewedAt).toLocaleDateString('en-IN') : ''}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function PatentShowcase() {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<ShowcasedPatent | null>(null);

  const showcasedQuery = useQuery({
    queryKey: ['patents', 'showcased'],
    queryFn: () => patentApi.getShowcased(),
    refetchInterval: 120_000,
  });

  const patents = showcasedQuery.data ?? [];

  return (
    <>
      <Card className="overflow-hidden">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="font-semibold text-white">Student Patents</span>
            {patents.length > 0 && (
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                {patents.length}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-slate-800">
            {showcasedQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : patents.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                No student patents are showcased yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {patents.map((patent) => (
                  <div key={patent._id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-bold text-white">
                          {patent.student.avatar ? (
                            <img src={patent.student.avatar} alt={patent.student.displayName} className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            patent.student.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-300 truncate">{patent.student.displayName}</span>
                        {patent.student.domain && (
                          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
                            {patent.student.domain}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">{patent.projectTitle}</div>
                      {patent.inventionCategory && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {INVENTION_CATEGORY_LABELS[patent.inventionCategory] ?? patent.inventionCategory}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelected(patent)}
                      className="shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {selected && (
        <PatentDetailModal patent={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
