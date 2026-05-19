import { useRef, type ComponentType } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  BarChart3,
  Building2,
  Eye,
  FileText,
  GraduationCap,
  Lightbulb,
  PiggyBank,
  School,
  ShieldCheck,
  TrendingUp,
  UserSearch,
  Users,
  Zap,
} from 'lucide-react';

type LucideIcon = ComponentType<{ className?: string }>;

type Role = {
  id: string;
  tag: string;
  icon: LucideIcon;
  headline: string;
  description: string;
  features: string[];
  featureIcons: LucideIcon[];
  gradient: string;
  glow: string;
  accent: string;
  accentDot: string;
  border: string;
  tagBg: string;
  align: 'left' | 'right';
  image: string;
};

const roles: Role[] = [
  {
    id: 'students',
    tag: 'Student Innovators',
    icon: GraduationCap,
    headline: 'The Student-to-CEO Pipeline.',
    description:
      'Access a Problem Bank of 1,750+ real-world challenges. Build products in a digital Product Workspace, earn instant IP protection, and generate royalties while you study.',
    features: [
      '1,750+ real-world challenges',
      'Instant IP protection',
      'Royalties while studying',
      'Live Innovation Score',
    ],
    featureIcons: [Lightbulb, ShieldCheck, TrendingUp, BarChart3],
    gradient: 'from-primary/20 via-primary/5 to-transparent',
    glow: 'bg-primary/10',
    accent: 'text-primary',
    accentDot: 'bg-primary',
    border: 'border-primary/20',
    tagBg: 'bg-primary/10 border-primary/20 text-primary',
    align: 'left',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
  },
  {
    id: 'schools',
    tag: 'Schools',
    icon: School,
    headline: 'The Innovation Hub.',
    description:
      'A real-time dashboard to monitor student breakthroughs the moment they happen. Generate one-click reports for NEP 2020 and SIC filings instantly — no paperwork, no delays.',
    features: [
      'Real-time breakthroughs',
      'One-click NEP 2020 reports',
      'Instant SIC filings',
      'Student progress visibility',
    ],
    featureIcons: [Eye, FileText, FileText, BarChart3],
    gradient: 'from-accent/20 via-accent/5 to-transparent',
    glow: 'bg-accent/10',
    accent: 'text-accent',
    accentDot: 'bg-accent',
    border: 'border-accent/20',
    tagBg: 'bg-accent/10 border-accent/20 text-accent',
    align: 'right',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80',
  },
  {
    id: 'colleges',
    tag: 'Colleges',
    icon: Building2,
    headline: 'Patent-Generating Campuses.',
    description:
      'A unified campus dashboard for startup and placement activity. Automate AICTE, NAAC, and NIRF compliance reporting with a single click and focus on what matters — innovation.',
    features: [
      'AICTE compliance automation',
      'NAAC one-click reports',
      'NIRF data dashboard',
      'Startup & placement tracking',
    ],
    featureIcons: [FileText, FileText, BarChart3, TrendingUp],
    gradient: 'from-chart-3/20 via-chart-3/5 to-transparent',
    glow: 'bg-chart-3/10',
    accent: 'text-chart-3',
    accentDot: 'bg-chart-3',
    border: 'border-chart-3/20',
    tagBg: 'bg-chart-3/10 border-chart-3/20 text-chart-3',
    align: 'left',
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80',
  },
  {
    id: 'mentors',
    tag: 'Mentors',
    icon: Users,
    headline: 'The Execution Intelligence Network.',
    description:
      'Industry leaders and educators track student progress, contribute to live projects, and earn their own Innovation Score — unlocking new income streams and recognition beyond the classroom.',
    features: [
      'Track student progress live',
      'Contribute to live projects',
      'Earn your Innovation Score',
      'Unlock new income pathways',
    ],
    featureIcons: [Eye, Lightbulb, BarChart3, TrendingUp],
    gradient: 'from-chart-4/20 via-chart-4/5 to-transparent',
    glow: 'bg-chart-4/10',
    accent: 'text-chart-4',
    accentDot: 'bg-chart-4',
    border: 'border-chart-4/20',
    tagBg: 'bg-chart-4/10 border-chart-4/20 text-chart-4',
    align: 'right',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
  },
  {
    id: 'recruiters',
    tag: 'HRs & Recruiters',
    icon: UserSearch,
    headline: 'Precision Hiring.',
    description:
      'Stop reading resumes. Start viewing real work. Filter candidates by their Innovation Score and watch their actual live prototypes before you send a single message.',
    features: [
      'View live prototypes',
      'Filter by Innovation Score',
      'Precision candidate matching',
      'Verified execution records',
    ],
    featureIcons: [Eye, BarChart3, UserSearch, ShieldCheck],
    gradient: 'from-chart-5/20 via-chart-5/5 to-transparent',
    glow: 'bg-chart-5/10',
    accent: 'text-chart-5',
    accentDot: 'bg-chart-5',
    border: 'border-chart-5/20',
    tagBg: 'bg-chart-5/10 border-chart-5/20 text-chart-5',
    align: 'left',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80',
  },
  {
    id: 'investors',
    tag: 'Investors',
    icon: PiggyBank,
    headline: 'The Marketplace of Ideas.',
    description:
      'Access a vetted pipeline of high-potential student startups and breakthrough patents. Use Pennywise Investments for micro-funding and track portfolio growth via real-time Innovation Scores.',
    features: [
      'Vetted startup pipeline',
      'Pennywise micro-funding',
      'Real-time portfolio tracking',
      'Breakthrough patent access',
    ],
    featureIcons: [TrendingUp, PiggyBank, BarChart3, ShieldCheck],
    gradient: 'from-primary/20 via-accent/5 to-transparent',
    glow: 'bg-primary/10',
    accent: 'text-primary',
    accentDot: 'bg-primary',
    border: 'border-primary/20',
    tagBg: 'bg-primary/10 border-primary/20 text-primary',
    align: 'right',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
  },
];

function RoleCard({ role, index }: { role: Role; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const isLeft = role.align === 'left';
  const Icon = role.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {index > 0 && (
        <div className="mx-auto mb-0 h-12 w-px bg-gradient-to-b from-transparent via-border to-transparent sm:h-16" />
      )}

      <div className="grid items-center gap-10 py-14 sm:py-20 md:grid-cols-2 md:gap-16 md:py-28 lg:gap-20">
        <div className={`${!isLeft ? 'md:order-2' : ''} space-y-6 sm:space-y-8`}>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-widest sm:text-xs ${role.tagBg}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {role.tag}
          </div>

          <h3 className="font-heading text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {role.headline}
          </h3>

          <p className="max-w-md font-body text-base leading-relaxed text-muted-foreground md:text-lg">
            {role.description}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {role.features.map((feat, i) => {
              const FIcon = role.featureIcons[i];
              return (
                <div key={feat} className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${role.glow} ${role.border}`}
                  >
                    <FIcon className={`h-3.5 w-3.5 ${role.accent}`} />
                  </div>
                  <span className="font-body text-xs leading-snug text-muted-foreground">
                    {feat}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${!isLeft ? 'md:order-1' : ''} relative`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: isLeft ? 40 : -40 }}
            animate={isInView ? { opacity: 1, scale: 1, x: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className={`pointer-events-none absolute -inset-6 ${role.glow} rounded-3xl opacity-60 blur-3xl`} />

            <div className={`relative overflow-hidden rounded-2xl border shadow-2xl ${role.border}`}>
              <img
                src={role.image}
                alt={role.tag}
                loading="lazy"
                className="h-56 w-full object-cover sm:h-64 md:h-80"
              />
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${role.gradient}`} />

              <div className="absolute inset-x-4 bottom-4">
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 p-3 backdrop-blur-md">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${role.glow} ${role.border}`}
                  >
                    <Zap className={`h-4 w-4 ${role.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate font-heading text-xs font-bold ${role.accent}`}>
                      {role.tag}
                    </p>
                    <p className="truncate font-body text-[11px] text-muted-foreground">
                      ProMove Cloud Dashboard
                    </p>
                  </div>
                  <div className="ml-auto">
                    <div className={`h-2 w-2 animate-pulse rounded-full ${role.accentDot}`} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </motion.div>
  );
}

export default function EcosystemSection() {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerInView = useInView(headerRef, { once: true, margin: '-100px' });

  return (
    <section id="ecosystem" className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="pb-8 pt-20 text-center sm:pt-24 md:pt-32"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-body text-[11px] font-medium uppercase tracking-wide text-primary sm:text-xs">
              Built for Everyone
            </span>
          </div>
          <h2 className="mb-5 font-heading text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            One platform.{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Every stakeholder.
            </span>
          </h2>
          <p className="mx-auto max-w-lg font-body text-base leading-relaxed text-muted-foreground">
            ProMove Cloud is engineered for the entire innovation ecosystem — from students to
            investors.
          </p>
        </motion.div>

        <div>
          {roles.map((role, index) => (
            <RoleCard key={role.id} role={role} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
