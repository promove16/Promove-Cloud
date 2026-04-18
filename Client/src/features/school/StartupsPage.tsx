import { schoolApi } from '../../api/school.api';
import { InstitutionInnovationPipelinePage } from '../institution/InstitutionInnovationPipelinePage';

export default function StartupsPage() {
  return (
    <InstitutionInnovationPipelinePage
      mode="school"
      institutionLabel="School"
      basePath="/dashboard/school"
      fetchProjects={schoolApi.getProjects}
      fetchPatents={schoolApi.getPatents}
      fetchStartups={schoolApi.getStartups}
    />
  );
}
