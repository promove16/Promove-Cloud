import { schoolApi } from '../../api/school.api';
import { InstitutionAnalyticsPage } from '../institution/InstitutionAnalyticsPage';

export default function SchoolAnalyticsPage() {
  return (
    <InstitutionAnalyticsPage
      mode="school"
      institutionLabel="School"
      basePath="/dashboard/school"
      fetchDashboard={schoolApi.getDashboard}
      fetchStartups={schoolApi.getStartups}
      fetchMentorshipPrograms={schoolApi.getMentorshipPrograms}
    />
  );
}
