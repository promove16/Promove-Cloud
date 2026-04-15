import { useSearchParams } from 'react-router-dom';
import { schoolApi } from '../../api/school.api';
import { Button } from '../../components/ui/Button';
import { LeaderboardPageBase } from '../institution/LeaderboardPageBase';
import { IssueAccessTokenDialog } from './IssueAccessTokenDialog';

export default function StudentLeaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const issueTokenOpen = searchParams.get('issueToken') === '1';

  const setIssueTokenOpen = (open: boolean) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set('issueToken', '1');
    } else {
      nextSearchParams.delete('issueToken');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <>
      <LeaderboardPageBase
        mode="school"
        title="Student Innovators"
        subtitle="Ranked by Innovation Score"
        basePath="/dashboard/school"
        fetchPage={(cursor) => schoolApi.getStudents(cursor)}
        fetchJourney={schoolApi.getStudentJourney}
        headerAction={<Button onClick={() => setIssueTokenOpen(true)}>Issue Access Token</Button>}
      />
      <IssueAccessTokenDialog open={issueTokenOpen} onOpenChange={setIssueTokenOpen} />
    </>
  );
}
