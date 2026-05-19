import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from './LandingButton';

export default function FinalCTA() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="relative overflow-hidden py-20 sm:py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[350px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 blur-[120px] sm:h-[500px] sm:w-[900px]" />
      </div>

      <div ref={ref} className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card/80 via-primary/5 to-accent/5 p-8 backdrop-blur-sm sm:p-12 md:p-16"
        >
          <div className="pointer-events-none absolute left-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-[80px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-full bg-accent/10 blur-[80px]" />

          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mb-8 flex h-16 w-16 items-center justify-center"
            >
              <img
                src="/image/promoveLogo.png"
                alt="ProMove Cloud"
                className="h-full w-full object-contain"
              />
            </motion.div>

            <h2 className="mb-5 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              The future doesn&apos;t wait{' '}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                for a degree.
              </span>
            </h2>
            <p className="mx-auto mb-10 max-w-lg font-body text-base leading-relaxed text-muted-foreground md:text-lg">
              Start executing today. Join thousands of innovators already building the future on
              ProMove Cloud.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="group w-full sm:w-auto">
                  Create Free Account
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/request-access" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Partner as Institution
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
