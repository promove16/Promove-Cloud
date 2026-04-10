interface AboutCardProps {
  description: string;
}

export function AboutCard({ description }: AboutCardProps) {
  return (
    <section className="rounded-2xl border border-cyan-500/15 bg-slate-900/70 p-6 shadow-lg shadow-cyan-500/5 transition hover:-translate-y-0.5 hover:shadow-cyan-500/10">
      <h3 className="text-xl font-semibold text-white">About</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
    </section>
  );
}

