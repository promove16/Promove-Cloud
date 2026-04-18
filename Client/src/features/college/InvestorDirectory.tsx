import { collegeApi } from '../../api/college.api';
import { InvestorDirectoryBase } from '../institution/InvestorDirectoryBase';

export default function InvestorDirectory() {
  return (
    <InvestorDirectoryBase
      mode="college"
      title="Investor Directory"
      subtitle="Connect with investors interested in student-led innovation"
      queryKey="college-investors"
      fetchInvestors={collegeApi.getInvestors}
    />
  );
}
