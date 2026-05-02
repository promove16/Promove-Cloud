import { schoolApi } from '../../api/school.api';
import { InstitutionCompliancePage } from '../institution/InstitutionCompliancePage';

export default function SchoolCompliancePage() {
  return (
    <InstitutionCompliancePage
      mode="school"
      institutionLabel="School"
      fetchOverview={schoolApi.getComplianceOverview}
      fetchSubmission={schoolApi.getComplianceSubmission}
      submitSubmission={schoolApi.submitComplianceSubmission}
      requestEvidenceEdit={schoolApi.requestComplianceEvidenceEdit}
      uploadEvidenceFile={schoolApi.uploadComplianceEvidence}
      fetchLatestReport={schoolApi.getLatestComplianceReport}
      generateReport={schoolApi.generateComplianceReport}
    />
  );
}
