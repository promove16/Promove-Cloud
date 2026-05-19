import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  BarChart3,
  Brain,
  CheckCircle2,
  FileText,
  Rocket,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const oldWorld = [
  { icon: FileText, text: 'CGPA & Percentages' },
  { icon: FileText, text: 'Degree Certificates' },
  { icon: FileText, text: 'Paper Resumes' },
  { icon: FileText, text: 'Memorization Tests' },
];

const newWorld = [
  { icon: Brain, text: 'Verifiable Actions' },
  { icon: Rocket, text: 'Live Prototyping' },
  { icon: ShieldCheck, text: 'Problem-Solving Records' },
  { icon: BarChart3, text: 'Data-Driven Score 0–1000' },
];

export default function InnovationScoreSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="score" className="relative overflow-hidden py-20 sm:py-24 md:py-32">
      <div className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[120px] sm:h-[600px] sm:w-[600px]" />

      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center sm:mb-16 md:mb-20"
        >
          <h2 className="mb-5 font-heading text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Your Innovation Score{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Changes Everything
            </span>
          </h2>
          <p className="mx-auto max-w-xl font-body text-base leading-relaxed text-muted-foreground">
            A data-driven alternative to standard resumes. Show recruiters what you can actually{' '}
            <em>do</em>, not just what you&apos;ve <em>memorized</em>.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm sm:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-foreground">The Old World</h3>
                <p className="font-body text-xs text-muted-foreground">Outdated metrics</p>
              </div>
            </div>
            <div className="space-y-3">
              {oldWorld.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <XCircle className="h-4 w-4 shrink-0 text-destructive/60" />
                  <span className="font-body text-sm text-muted-foreground line-through">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-6 backdrop-blur-sm sm:p-8"
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-50" />
            <div className="relative">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground">The New World</h3>
                  <p className="font-body text-xs text-primary">Innovation Score 0–1000</p>
                </div>
              </div>
              <div className="space-y-3">
                {newWorld.map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/10 p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-body text-sm font-medium text-foreground">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
