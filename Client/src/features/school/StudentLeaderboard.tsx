import { schoolApi } from '../../api/school.api';
import { LeaderboardPageBase } from '../institution/LeaderboardPageBase';

export default function StudentLeaderboard() {
  return (
    <LeaderboardPageBase
      mode="school"
      title="Student Innovators"
      subtitle="Ranked by Innovation Score"
      basePath="/dashboard/school"
      fetchPage={(cursor) => schoolApi.getStudents(cursor)}
      fetchJourney={schoolApi.getStudentJourney}
    />
  );
}
