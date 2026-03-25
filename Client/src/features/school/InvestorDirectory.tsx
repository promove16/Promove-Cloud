import { schoolApi } from '../../api/school.api';
import { InvestorDirectoryBase } from '../institution/InvestorDirectoryBase';

export default function InvestorDirectory() {
  return (
    <InvestorDirectoryBase
      title="Investor Directory"
      subtitle="Connect with investors interested in innovation"
      queryKey="school-investors"
      fetchInvestors={schoolApi.getInvestors}
    />
  );
}
