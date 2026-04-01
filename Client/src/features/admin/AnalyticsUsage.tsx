import { UsagePulsePanel } from './UsagePulsePanel';
import { useAdminAnalyticsContext } from './Analytics';

export default function AnalyticsUsage() {
  const { analytics } = useAdminAnalyticsContext();

  return <UsagePulsePanel analytics={analytics} />;
}
