import { collegeApi } from '../../api/college.api';
import { InstitutionInnovationPipelinePage } from '../institution/InstitutionInnovationPipelinePage';

export default function PatentsPage() {
  return (
    <InstitutionInnovationPipelinePage
      mode="college"
      institutionLabel="College"
      basePath="/dashboard/college"
      fetchProjects={collegeApi.getProjects}
      fetchPatents={collegeApi.getPatents}
      fetchStartups={collegeApi.getStartups}
    />
  );
}
