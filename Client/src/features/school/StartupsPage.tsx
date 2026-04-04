import { schoolApi } from '../../api/school.api';
import { InstitutionStartupsPageBase } from '../institution/InstitutionStartupsPageBase';

export default function StartupsPage() {
  return (
    <InstitutionStartupsPageBase
      mode="school"
      title="School Startups"
      subtitle="Student startup launches and review readiness for this school."
      basePath="/dashboard/school"
      fetchStartups={schoolApi.getStartups}
    />
  );
}
