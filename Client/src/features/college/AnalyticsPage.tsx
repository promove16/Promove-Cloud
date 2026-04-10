import { collegeApi } from '../../api/college.api';
import { InstitutionAnalyticsPage } from '../institution/InstitutionAnalyticsPage';

export default function CollegeAnalyticsPage() {
  return (
    <InstitutionAnalyticsPage
      mode="college"
      institutionLabel="College"
      basePath="/dashboard/college"
      fetchDashboard={collegeApi.getDashboard}
      fetchStartups={collegeApi.getStartups}
      fetchMentorshipPrograms={collegeApi.getMentorshipPrograms}
    />
  );
}
