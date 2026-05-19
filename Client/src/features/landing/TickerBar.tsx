import { Briefcase, Lightbulb, TrendingUp, Zap } from 'lucide-react';

const items = [
  { icon: Briefcase, text: '500+ Jobs Waiting' },
  { icon: Lightbulb, text: '1,750+ Industry Problems' },
  { icon: TrendingUp, text: '₹15Cr Investment Pool Available' },
  { icon: Zap, text: 'Innovation Scores Updated Live' },
];

export default function TickerBar() {
  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-full border border-border/40 bg-muted/30 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div className="flex animate-ticker-scroll whitespace-nowrap py-2.5">
        {[...items, ...items, ...items, ...items].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={`${item.text}-${i}`} className="mx-6 flex shrink-0 items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-xs font-medium text-muted-foreground">
                {item.text}
              </span>
              <span className="mx-3 text-border">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
