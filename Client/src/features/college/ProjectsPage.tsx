import { collegeApi } from '../../api/college.api';
import { InstitutionProjectsPageBase } from '../institution/InstitutionProjectsPageBase';

export default function ProjectsPage() {
  return (
    <InstitutionProjectsPageBase
      mode="college"
      title="College Projects"
      subtitle="Detailed active project list for student innovators in this college."
      basePath="/dashboard/college"
      fetchProjects={collegeApi.getProjects}
    />
  );
}
