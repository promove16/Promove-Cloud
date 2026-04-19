interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  period: string;
}

interface ExperienceSectionProps {
  items: ExperienceItem[];
}

export function ExperienceSection({ items }: ExperienceSectionProps) {
  const visible = items.slice(0, 4);

  return (
    <section className="border-t border-slate-800 pt-8">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-[34px] font-semibold leading-none text-slate-100">Experience</h3>
        <button type="button" className="text-sm font-medium text-sky-600 hover:underline">
          Show Details
        </button>
      </div>

      {visible.length > 0 ? (
        <div className="relative mt-4 pl-10">
          <div className="absolute bottom-2 left-3.5 top-2 w-px bg-slate-800" />
          <div className="space-y-6">
            {visible.map((item, index) => (
              <article key={item.id} className="relative border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
                <span
                  className={`absolute -left-10 top-1 h-4 w-4 rounded-full border-2 ${index === 0 ? "border-cyan-400" : "border-slate-600"} bg-slate-950`}
                />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <div className="text-2xl font-medium text-slate-100">
                      {item.title} <span className="mx-2 text-slate-500">-</span>
                      <span className="text-xl text-slate-400">{item.company}</span>
                    </div>
                    {item.location ? <div className="mt-1 text-sm text-slate-400">{item.location}</div> : null}
                  </div>
                  <div className="text-right text-sm font-medium text-slate-400">{item.period}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">No experience added yet.</div>
      )}
    </section>
  );
}
