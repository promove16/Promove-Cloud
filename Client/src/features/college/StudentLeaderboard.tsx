import { collegeApi } from '../../api/college.api';
import { LeaderboardPageBase } from '../institution/LeaderboardPageBase';

export default function StudentLeaderboard() {
  return (
    <LeaderboardPageBase
      mode="college"
      title="Student Innovators"
      subtitle="Ranked by Innovation Score"
      basePath="/dashboard/college"
      fetchPage={(cursor) => collegeApi.getStudents(cursor)}
      fetchJourney={collegeApi.getStudentJourney}
    />
  );
}
