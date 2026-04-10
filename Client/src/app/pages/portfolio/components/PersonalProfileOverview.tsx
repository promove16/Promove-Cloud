interface MetricItem {
  label: string;
  value: string | number;
}

interface PersonalProfileOverviewProps {
  title: string;
  subtitle: string;
  summary: string;
  metrics: MetricItem[];
}

function PersonalProfileOverviewCard({
  title,
  subtitle,
  summary,
  metrics,
}: PersonalProfileOverviewProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">{subtitle}</div>
          <h3 className="mt-2 text-2xl font-semibold text-slate-100">{title}</h3>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">{summary}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-100">{metric.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface RoleOverviewMetricsProps {
  location: string;
  summary: string;
  skillCount: number;
  projectCount: number;
  educationCount: number;
  startupCount: number;
  innovationScore: number;
  experienceCount: number;
  certificationCount: number;
}

export function StudentProfileOverview(props: RoleOverviewMetricsProps) {
  return (
    <PersonalProfileOverviewCard
      title="Student Innovation Profile"
      subtitle={props.location}
      summary={props.summary}
      metrics={[
        { label: "Innovation Score", value: props.innovationScore },
        { label: "Skills", value: props.skillCount },
        { label: "Projects", value: props.projectCount },
        { label: "Startups", value: props.startupCount },
      ]}
    />
  );
}

export function MentorProfileOverview(props: RoleOverviewMetricsProps) {
  return (
    <PersonalProfileOverviewCard
      title="Mentor Advisory Profile"
      subtitle={props.location}
      summary={props.summary}
      metrics={[
        { label: "Experience", value: props.experienceCount },
        { label: "Skills", value: props.skillCount },
        { label: "Projects", value: props.projectCount },
        { label: "Education", value: props.educationCount },
      ]}
    />
  );
}

export function InvestorProfileOverview(props: RoleOverviewMetricsProps) {
  return (
    <PersonalProfileOverviewCard
      title="Investor Thesis Profile"
      subtitle={props.location}
      summary={props.summary}
      metrics={[
        { label: "Portfolio Work", value: props.projectCount },
        { label: "Sectors", value: props.skillCount },
        { label: "Education", value: props.educationCount },
        { label: "Credentials", value: props.certificationCount },
      ]}
    />
  );
}

export function RecruiterProfileOverview(props: RoleOverviewMetricsProps) {
  return (
    <PersonalProfileOverviewCard
      title="Hiring Profile"
      subtitle={props.location}
      summary={props.summary}
      metrics={[
        { label: "Experience", value: props.experienceCount },
        { label: "Skills", value: props.skillCount },
        { label: "Projects", value: props.projectCount },
        { label: "Credentials", value: props.certificationCount },
      ]}
    />
  );
}
