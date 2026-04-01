import { UserIntelligencePanel } from './UserIntelligencePanel';
import { useAdminAnalyticsContext } from './Analytics';

export default function AnalyticsUsers() {
  const { analytics } = useAdminAnalyticsContext();

  return <UserIntelligencePanel analytics={analytics} />;
}
