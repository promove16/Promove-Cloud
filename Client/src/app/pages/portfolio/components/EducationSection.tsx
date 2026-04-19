interface EducationItem {
  id: string;
  period: string;
  institution: string;
  details: string;
}

interface EducationSectionProps {
  items: EducationItem[];
}

export function EducationSection({ items }: EducationSectionProps) {
  return (
    <section className="border-t border-slate-800 pt-8">
      <h3 className="border-b border-slate-800 pb-3 text-[34px] font-semibold leading-none text-slate-100">
        Education
      </h3>
      {items.length > 0 ? (
        <div className="mt-4 space-y-6">
          {items.slice(0, 3).map((item) => (
            <article key={item.id} className="grid gap-2 border-b border-slate-800 pb-6 last:border-b-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)]">
              <div className="text-xs text-slate-500">{item.period}</div>
              <div>
                <h4 className="text-2xl font-medium text-slate-100">{item.institution}</h4>
                <p className="mt-1 text-sm text-slate-400">{item.details}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-500">No education added yet.</div>
      )}
    </section>
  );
}
