interface StartupItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
}

interface StartupListProps {
  startups: StartupItem[];
}

export function StartupList({ startups }: StartupListProps) {
  return (
    <section className="border-t border-slate-800 pt-8">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-[34px] font-semibold leading-none text-slate-100">Startups</h3>
      </div>
      {startups.length > 0 ? (
        <div className="mt-4">
          {startups.slice(0, 3).map((startup) => (
            <article key={startup.id} className="border-b border-slate-800 py-4 last:border-b-0 last:pb-0">
              <h4 className="text-lg font-semibold text-slate-100">{startup.title}</h4>
              <p className="mt-1 text-sm text-slate-400">{startup.description}</p>
              <div className="mt-1 text-xs text-slate-500">
                {[...startup.tags, startup.status].filter(Boolean).join("  ")}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">No startups linked yet.</div>
      )}
    </section>
  );
}
