import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Award, ShieldCheck } from 'lucide-react';

const badges = [
  { name: '#StartupIndia' },
  { name: 'MSME' },
  { name: 'AICTE' },
  { name: 'DPIIT' },
  { name: 'NITI Aayog' },
  { name: 'ISO 21001' },
];

export default function SocialProof() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="recognition" className="relative overflow-hidden py-20 sm:py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px] sm:h-[400px] sm:w-[700px]" />
      </div>

      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-chart-3/40 bg-chart-3/10 px-5 py-2 sm:mb-8">
            <ShieldCheck className="h-4 w-4 text-chart-3" />
            <span className="font-body text-sm font-semibold text-chart-3">
              Government Recognized
            </span>
          </div>

          <h2 className="mb-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Trusted by the{' '}
            <span className="bg-gradient-to-r from-chart-3 to-primary bg-clip-text text-transparent">
              Nation&apos;s Best
            </span>
          </h2>
          <p className="mx-auto mb-12 max-w-lg font-body text-base text-muted-foreground sm:mb-14">
            Backed and recognized by India&apos;s top regulatory bodies and innovation councils.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6 md:gap-6"
        >
          {badges.map((badge, i) => (
            <motion.div
              key={badge.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card/60"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-muted/50 transition-all group-hover:border-primary/20 group-hover:bg-primary/10">
                <Award className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <span className="font-body text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                {badge.name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
