import { UserRole } from "../../../../types/roles.types";
import type { InstitutionTrendGraph } from "../../../../types/school.types";

interface FieldItem {
  label: string;
  value: string | number;
}

interface InstitutionInsightsSectionProps {
  role: UserRole.SCHOOL | UserRole.COLLEGE;
  aboutText: string;
  fields: FieldItem[];
  trendGraph?: InstitutionTrendGraph;
  specialties: string[];
  locations: string[];
  policies: Array<{ name: string; status: string }>;
}

function buildPath(values: number[], maxValue: number, width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (maxValue > 0 ? (value / maxValue) * height : height);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function linePoint(value: number, index: number, maxValue: number, width: number, height: number, total: number) {
  const stepX = total > 1 ? width / (total - 1) : width;
  return {
    x: index * stepX,
    y: height - (maxValue > 0 ? (value / maxValue) * height : height),
  };
}

function formatTickLabel(label: string) {
  const parsed = new Date(`${label}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? label
    : parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function buildYAxisValues(maxValue: number) {
  const normalizedMax = maxValue <= 4 ? 4 : Math.ceil(maxValue / 4) * 4;
  return Array.from({ length: 5 }, (_, index) => normalizedMax - (normalizedMax / 4) * index);
}

export function InstitutionInsightsSection({
  role,
  aboutText,
  fields,
  trendGraph,
  specialties,
  locations,
  policies,
}: InstitutionInsightsSectionProps) {
  const roleLabel = role === UserRole.SCHOOL ? "School" : "College";
  const supportTitle = role === UserRole.SCHOOL ? "Campus Reach" : "Business Policies";
  const supportItems =
    role === UserRole.SCHOOL
      ? locations.slice(0, 5)
      : policies.slice(0, 5).map((policy) => `${policy.name} - ${policy.status}`);
  const labels = trendGraph?.labels ?? [];
  const series = trendGraph?.series ?? [];
  const maxValue = Math.max(...series.flatMap((item) => item.values), 0);
  const yAxisValues = buildYAxisValues(maxValue);
  const normalizedMax = yAxisValues[0] ?? 4;
  const chartWidth = 560;
  const chartHeight = 220;
  const tickInterval = labels.length > 10 ? Math.ceil(labels.length / 6) : 1;
  const highestSeries =
    series
      .map((item) => ({
        label: item.label,
        peak: Math.max(...item.values, 0),
      }))
      .sort((left, right) => right.peak - left.peak)[0] ?? null;
  const totalEvents = series.reduce(
    (total, item) => total + item.values.reduce((seriesTotal, value) => seriesTotal + value, 0),
    0,
  );

  return (
    <section className="border-t border-slate-800 pt-4">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Business Profile</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-100">{roleLabel} Overview</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{aboutText}</p>
          </div>

          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="border-b border-slate-800 pb-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{field.label}</div>
                <div className="mt-1 text-sm font-medium text-slate-100">{field.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Focus Areas</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {specialties.length > 0 ? (
                  specialties.slice(0, 6).map((specialty) => (
                    <span
                      key={specialty}
                      className="border-b border-cyan-500/40 pb-1 text-xs font-medium text-cyan-200"
                    >
                      {specialty}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No focus areas added yet.</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{supportTitle}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {supportItems.length > 0 ? (
                  supportItems.map((item) => (
                    <li key={item} className="border-b border-slate-800 pb-2">
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400">No supporting details available yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-l border-slate-800 pl-0 xl:pl-6">
          <div className="flex items-end justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-400">Trend Graph</div>
              <h3 className="mt-2 text-2xl font-semibold text-slate-100">Daily Historical Activity</h3>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {series.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {labels.length > 0 && series.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-slate-950 px-3 py-4">
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
                  Total Events <span className="ml-1 font-semibold text-slate-100">{totalEvents}</span>
                </div>
                {highestSeries ? (
                  <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
                    Peak {highestSeries.label}
                    <span className="ml-1 font-semibold text-slate-100">{highestSeries.peak}</span>
                  </div>
                ) : null}
                <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">
                  Daily Scale <span className="ml-1 font-semibold text-slate-100">0-{normalizedMax}</span>
                </div>
              </div>

              <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                <div className="flex h-[250px] flex-col justify-between pb-7 pt-1 text-right text-[11px] text-slate-500">
                  {yAxisValues.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>

                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
                  className="h-[250px] w-full"
                  role="img"
                  aria-label="Institution trend graph"
                >
                  {[0, 1, 2, 3, 4].map((row) => {
                    const y = (chartHeight / 4) * row;
                    return (
                      <line
                        key={row}
                        x1="0"
                        y1={y}
                        x2={chartWidth}
                        y2={y}
                        stroke="rgba(51,65,85,0.75)"
                        strokeWidth="1"
                        strokeDasharray="4 6"
                      />
                    );
                  })}

                  {series.map((item) => (
                    <path
                      key={item.label}
                      d={buildPath(item.values, normalizedMax, chartWidth, chartHeight)}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}

                  {series.flatMap((item) =>
                    item.values.map((value, index) => {
                      const point = linePoint(value, index, normalizedMax, chartWidth, chartHeight, item.values.length);
                      return (
                        <circle
                          key={`${item.label}-${labels[index]}`}
                          cx={point.x}
                          cy={point.y}
                          r="3.5"
                          fill={item.color}
                          stroke="#020617"
                          strokeWidth="2"
                        />
                      );
                    }),
                  )}

                  {labels.map((label, index) => {
                    if (index !== 0 && index !== labels.length - 1 && index % tickInterval !== 0) {
                      return null;
                    }

                    const point = linePoint(0, index, 1, chartWidth, 0, labels.length);
                    return (
                      <text
                        key={label}
                        x={point.x}
                        y={chartHeight + 22}
                        fill="#64748b"
                        fontSize="12"
                        textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
                      >
                        {formatTickLabel(label)}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-6 text-sm text-slate-400">
              No historical activity data is available yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
