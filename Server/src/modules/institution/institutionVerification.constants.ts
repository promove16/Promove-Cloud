export const INSTITUTION_REGULATORY_BODIES = [
  'AICTE',
  'UGC',
  'NAAC',
  'NBA',
  'CBSE',
  'ICSE',
  'STATE_BOARD',
  'STATE_EDUCATION_DEPARTMENT',
  'UDISE',
] as const;

export const INSTITUTION_DOCUMENT_CATEGORIES = [
  'governing_body_registration_certificate',
  'authorized_signatory_letter',
  'address_proof',
  'pan_or_tax_registration',
  'recognition_certificate',
  'board_affiliation_certificate',
  'udise_certificate',
  'affiliation_letter',
  'aicte_approval_letter',
  'ugc_recognition_letter',
  'accreditation_certificate',
] as const;

export const INSTITUTION_DOCUMENT_LABELS: Record<
  (typeof INSTITUTION_DOCUMENT_CATEGORIES)[number],
  string
> = {
  governing_body_registration_certificate:
    'governing body registration certificate or trust/society incorporation proof',
  authorized_signatory_letter:
    'authorized signatory letter on institution letterhead',
  address_proof: 'institution address proof',
  pan_or_tax_registration: 'PAN or tax registration proof',
  recognition_certificate: 'school recognition certificate from the competent authority',
  board_affiliation_certificate: 'board affiliation certificate',
  udise_certificate: 'UDISE code proof or school report card',
  affiliation_letter: 'university or board affiliation letter',
  aicte_approval_letter: 'AICTE approval or Extension of Approval letter',
  ugc_recognition_letter: 'UGC recognition or relevant statutory recognition letter',
  accreditation_certificate: 'NAAC or NBA accreditation certificate',
};
