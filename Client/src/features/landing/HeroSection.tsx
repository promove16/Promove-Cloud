import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Lightbulb, TrendingUp } from 'lucide-react';
import { Button } from './LandingButton';
import TickerBar from './TickerBar';

const stats = [
  { icon: Briefcase, label: 'Jobs Waiting', value: '500+', color: 'text-primary' },
  { icon: Lightbulb, label: 'Industry Problems', value: '1,750+', color: 'text-accent' },
  { icon: TrendingUp, label: 'Investment Pool', value: '₹15Cr', color: 'text-chart-3' },
];

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-24 sm:pt-28">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px] animate-glow-pulse sm:h-[800px] sm:w-[800px]" />
        <div
          className="absolute bottom-1/4 right-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-[100px] animate-glow-pulse sm:h-[500px] sm:w-[500px]"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 text-center sm:px-6 sm:py-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 sm:mb-8"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="font-body text-[11px] font-medium uppercase tracking-wide text-primary sm:text-xs">
            National Innovation Infrastructure
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mb-5 font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Stop dreaming,{' '}
          <span className="relative inline-block">
            <span className="relative z-10 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              start executing.
            </span>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-accent to-primary opacity-60" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mx-auto mb-8 max-w-2xl px-2 font-body text-base leading-relaxed text-muted-foreground sm:mb-10 sm:text-lg md:text-xl"
        >
          Moving beyond CGPA and percentages. ProMove is the world&apos;s first{' '}
          <span className="font-medium text-foreground">Instant Execution Engine</span> that turns
          your potential into a verifiable{' '}
          <span className="font-semibold text-primary">Innovation Score</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mb-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 sm:mb-14"
        >
          <Link to="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="group w-full sm:w-auto">
              Get Started
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <a href="#ecosystem" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Watch Demo
            </Button>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mx-auto mb-12 w-full"
        >
          <TickerBar />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative rounded-xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/30"
              >
                <Icon className={`mb-2 h-5 w-5 ${stat.color}`} />
                <div className="font-heading text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="mt-1 font-body text-xs text-muted-foreground">{stat.label}</div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
