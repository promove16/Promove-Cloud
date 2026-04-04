import { schoolApi } from '../../api/school.api';
import { InstitutionProjectsPageBase } from '../institution/InstitutionProjectsPageBase';

export default function ProjectsPage() {
  return (
    <InstitutionProjectsPageBase
      mode="school"
      title="School Projects"
      subtitle="Detailed active project list for student innovators in this school."
      basePath="/dashboard/school"
      fetchProjects={schoolApi.getProjects}
    />
  );
}
