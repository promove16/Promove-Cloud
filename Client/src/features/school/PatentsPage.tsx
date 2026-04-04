import { schoolApi } from '../../api/school.api';
import { InstitutionPatentsPageBase } from '../institution/InstitutionPatentsPageBase';

export default function PatentsPage() {
  return (
    <InstitutionPatentsPageBase
      mode="school"
      title="School Patents"
      subtitle="Institution patent submissions with student ownership and status details."
      basePath="/dashboard/school"
      fetchPatents={schoolApi.getPatents}
    />
  );
}
