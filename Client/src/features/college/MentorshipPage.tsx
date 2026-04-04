import { collegeApi } from '../../api/college.api';
import { InstitutionMentorshipPage } from '../institution/InstitutionMentorshipPage';

export default function CollegeMentorshipPage() {
  return (
    <InstitutionMentorshipPage
      queryKey="college-mentorship-programs"
      institutionLabel="College"
      description="Request mentorship programs for your college, route them to admin for approval, and monitor mentor assignment and scheduling decisions without leaving the workspace."
      fetchPrograms={collegeApi.getMentorshipPrograms}
      createProgram={collegeApi.createMentorshipProgram}
    />
  );
}
