import { collegeApi } from '../../api/college.api';
import { InstitutionCompliancePage } from '../institution/InstitutionCompliancePage';

export default function CollegeCompliancePage() {
  return (
    <InstitutionCompliancePage
      mode="college"
      institutionLabel="College"
      fetchOverview={collegeApi.getComplianceOverview}
      fetchSubmission={collegeApi.getComplianceSubmission}
      submitSubmission={collegeApi.submitComplianceSubmission}
      requestEvidenceEdit={collegeApi.requestComplianceEvidenceEdit}
      uploadEvidenceFile={collegeApi.uploadComplianceEvidence}
      fetchLatestReport={collegeApi.getLatestComplianceReport}
      generateReport={collegeApi.generateComplianceReport}
    />
  );
}
