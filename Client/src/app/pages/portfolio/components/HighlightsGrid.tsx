import { Building2, MapPin, Sparkles, type LucideIcon } from "lucide-react";

interface HighlightCard {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

interface HighlightsGridProps {
  cards: HighlightCard[];
}

export function HighlightsGrid({ cards }: HighlightsGridProps) {
  const fallbackCards: HighlightCard[] = [
    { title: "Specialty", subtitle: "Institution profile", icon: Building2 },
    { title: "Location", subtitle: "Campus location not added", icon: MapPin },
    { title: "Outcome", subtitle: "Outcomes will appear once data is available", icon: Sparkles },
  ];

  const source = cards.length > 0 ? cards : fallbackCards;

  return (
    <section className="rounded-2xl border border-cyan-500/15 bg-slate-900 p-6 shadow-lg shadow-cyan-500/5">
      <h3 className="text-xl font-semibold text-white">Page Highlights</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {source.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-slate-800 bg-slate-950 p-4 transition duration-200 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
              <card.icon className="h-5 w-5" />
            </div>
            <h4 className="mt-3 text-base font-semibold text-white">{card.title}</h4>
            <p className="mt-1 text-sm text-slate-400">{card.subtitle}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

