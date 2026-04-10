interface FeaturedItem {
  id: string;
  title: string;
  subtitle: string;
}

interface SkillsFeaturedSectionProps {
  skills: string[];
  featured: FeaturedItem[];
}

export function SkillsFeaturedSection({ skills, featured }: SkillsFeaturedSectionProps) {
  return (
    <section className="grid gap-8 border-t border-slate-800/80 pt-8 lg:grid-cols-2 lg:gap-12">
      <article>
        <h3 className="border-b border-slate-800/80 pb-3 text-[34px] font-semibold leading-none text-slate-100">
          Skills
        </h3>
        {skills.length > 0 ? (
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            {skills.slice(0, 6).map((skill) => (
              <li key={skill} className="flex items-center gap-2">
                <span className="text-slate-500">*</span>
                <span>{skill}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 text-sm text-slate-500">No skills added yet.</div>
        )}
      </article>

      <article className="lg:border-l lg:border-slate-800/80 lg:pl-12">
        <h3 className="border-b border-slate-800/80 pb-3 text-[34px] font-semibold leading-none text-slate-100">
          Featured
        </h3>
        {featured.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {featured.slice(0, 4).map((item) => (
              <li key={item.id} className="text-sm">
                <div className="flex items-start gap-2 text-slate-200">
                  <span className="text-slate-500">*</span>
                  <span>{item.title}</span>
                </div>
                <div className="ml-4 mt-0.5 text-xs text-slate-500">{item.subtitle}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 text-sm text-slate-500">No featured work added yet.</div>
        )}
      </article>
    </section>
  );
}
