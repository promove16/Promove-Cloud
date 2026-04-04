import { schoolApi } from '../../api/school.api';
import { InstitutionMentorshipPage } from '../institution/InstitutionMentorshipPage';

export default function SchoolMentorshipPage() {
  return (
    <InstitutionMentorshipPage
      queryKey="school-mentorship-programs"
      institutionLabel="School"
      description="Request mentorship programs for your school, send them to admin for approval, and track assigned mentors and scheduling decisions in one place."
      fetchPrograms={schoolApi.getMentorshipPrograms}
      createProgram={schoolApi.createMentorshipProgram}
    />
  );
}
