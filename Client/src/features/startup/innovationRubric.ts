import type {
  StartupDocumentCategory,
  StartupInnovationProfile,
  StartupInnovationScoreBreakdown,
  StartupLegalEntityType,
  StartupScoringStage,
  StartupFundingStatus,
  StartupPatentStatus,
} from '../../types/startup.types';

export const STARTUP_RUBRIC_VERSION = 'startup_innovation_1000' as const;
export const STARTUP_RUBRIC_DOCUMENT_MAX_BYTES = 3 * 1024 * 1024;
export const STARTUP_RUBRIC_PITCH_MAX_BYTES = 10 * 1024 * 1024;
export const STARTUP_RUBRIC_PITCH_ACCEPT = '.pdf,.ppt,.pptx';

export const DEFAULT_STARTUP_INNOVATION_PROFILE: StartupInnovationProfile = {
  rubricVersion: STARTUP_RUBRIC_VERSION,
  companyProfile: {
    legalStructure: 'not_registered',
    cinNumber: '',
    dpiitRecognitionNumber: '',
    msmeUdyamNumber: '',
    otherGovernmentCertificationName: '',
    otherGovernmentCertificationNumber: '',
    websiteUrl: '',
    productDemoUrl: '',
    portfolioUrl: '',
  },
  tractionProfile: {
    startupStage: 'idea',
    problemClarity: '',
    uniqueSolution: '',
    marketDifferentiation: '',
    patentStatus: 'none',
    hasItrFiling: false,
    hasRevenueProof: false,
    hasGovernmentGrant: false,
    hasAwardRecognition: false,
    fundingStatus: 'none',
    activeUsersCustomers: 0,
    monthlyGrowthRate: 0,
    retentionRate: 0,
  },
};

export const STARTUP_LEGAL_STRUCTURE_OPTIONS: Array<{
  value: StartupLegalEntityType;
  label: string;
}> = [
  { value: 'not_registered', label: 'Not registered' },
  { value: 'sole_proprietorship', label: 'Sole proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'opc', label: 'OPC' },
];

export const STARTUP_SCORING_STAGE_OPTIONS: Array<{
  value: StartupScoringStage;
  label: string;
  points: number;
}> = [
  { value: 'idea', label: 'Idea Stage', points: 50 },
  { value: 'mvp_ready', label: 'MVP Ready', points: 100 },
  { value: 'market_ready', label: 'Market Ready', points: 150 },
  { value: 'revenue_generating', label: 'Revenue Generating', points: 200 },
];

export const STARTUP_PATENT_STATUS_OPTIONS: Array<{
  value: StartupPatentStatus;
  label: string;
}> = [
  { value: 'none', label: 'No patent yet' },
  { value: 'filed', label: 'Patent filed' },
  { value: 'published', label: 'Patent published' },
];

export const STARTUP_FUNDING_STATUS_OPTIONS: Array<{
  value: StartupFundingStatus;
  label: string;
}> = [
  { value: 'none', label: 'No funding yet' },
  { value: 'bootstrapped', label: 'Bootstrapped' },
  { value: 'angel_seed', label: 'Angel / Seed funding' },
  { value: 'vc', label: 'VC funding' },
];

export const STARTUP_RUBRIC_DOCUMENT_SPECS: Array<{
  category: StartupDocumentCategory;
  label: string;
  hint: string;
}> = [
  {
    category: 'incorporation_certificate',
    label: 'Certificate of incorporation',
    hint: 'Use when CIN and legal registration are claimed.',
  },
  {
    category: 'dpiit_certificate',
    label: 'DPIIT recognition proof',
    hint: 'Startup India / DPIIT certificate or proof document.',
  },
  {
    category: 'udyam_certificate',
    label: 'MSME / Udyam proof',
    hint: 'Certificate or downloaded acknowledgement.',
  },
  {
    category: 'government_certificate_other',
    label: 'Other government certification proof',
    hint: 'State startup mission or sector certification proof.',
  },
  {
    category: 'dpr',
    label: 'DPR upload',
    hint: 'Detailed Project Report in PDF.',
  },
  {
    category: 'patent_proof',
    label: 'Patent proof',
    hint: 'Filing acknowledgement or publication certificate.',
  },
  {
    category: 'itr_filing',
    label: 'ITR filing proof',
    hint: 'Acknowledgement or filing receipt.',
  },
  {
    category: 'revenue_proof',
    label: 'Revenue proof',
    hint: 'Bank statement, invoice summary, or customer report.',
  },
  {
    category: 'grant_certificate',
    label: 'Grant proof',
    hint: 'Government grant sanction letter or certificate.',
  },
  {
    category: 'award_certificate',
    label: 'Award / recognition proof',
    hint: 'Certificate, letter, or photo proof in one file.',
  },
  {
    category: 'funding_proof',
    label: 'Funding proof',
    hint: 'Term sheet, agreement, or fund transfer proof.',
  },
];

export const REGISTERED_ENTITY_TYPES = new Set<StartupLegalEntityType>([
  'llp',
  'private_limited',
  'opc',
]);

const calculateMetricScore = (
  value: number,
  thresholds: Array<{ min: number; score: number }>,
) => {
  for (const threshold of thresholds) {
    if (value >= threshold.min) {
      return threshold.score;
    }
  }
  return 0;
};

export const buildInnovationScorePreview = (input: {
  innovationProfile: StartupInnovationProfile;
  pitchDeckUploaded: boolean;
  uploadedDocumentCategories: StartupDocumentCategory[];
}): StartupInnovationScoreBreakdown => {
  const uploadedDocuments = new Set(input.uploadedDocumentCategories);
  const { companyProfile, tractionProfile } = input.innovationProfile;

  const legalStructure = REGISTERED_ENTITY_TYPES.has(companyProfile.legalStructure) ? 50 : 0;
  const cinNumber =
    companyProfile.cinNumber.trim() && uploadedDocuments.has('incorporation_certificate')
      ? 30
      : 0;
  const dpiitRecognition =
    companyProfile.dpiitRecognitionNumber.trim() && uploadedDocuments.has('dpiit_certificate')
      ? 70
      : 0;
  const msmeUdyam =
    companyProfile.msmeUdyamNumber.trim() && uploadedDocuments.has('udyam_certificate')
      ? 20
      : 0;
  const otherGovernmentCertification =
    (companyProfile.otherGovernmentCertificationName.trim() ||
      companyProfile.otherGovernmentCertificationNumber.trim()) &&
    uploadedDocuments.has('government_certificate_other')
      ? 10
      : 0;
  const governmentRecognition = Math.min(
    100,
    dpiitRecognition + msmeUdyam + otherGovernmentCertification,
  );
  const companyDocumentation =
    input.pitchDeckUploaded || uploadedDocuments.has('dpr') ? 50 : 0;
  const portfolioPresence =
    companyProfile.websiteUrl.trim() ||
    companyProfile.productDemoUrl.trim() ||
    companyProfile.portfolioUrl.trim()
      ? 20
      : 0;

  const stageScoreMap: Record<StartupScoringStage, number> = {
    idea: 50,
    mvp_ready: 100,
    market_ready: 150,
    revenue_generating: 200,
  };
  const startupStage = stageScoreMap[tractionProfile.startupStage] ?? 0;
  const problemClarity = tractionProfile.problemClarity.trim().length >= 30 ? 40 : 0;
  const uniqueSolution = tractionProfile.uniqueSolution.trim().length >= 30 ? 40 : 0;
  const marketDifferentiation =
    tractionProfile.marketDifferentiation.trim().length >= 30 ? 40 : 0;
  const innovationUniqueness = problemClarity + uniqueSolution + marketDifferentiation;
  const patentStrength =
    tractionProfile.patentStatus === 'published' && uploadedDocuments.has('patent_proof')
      ? 120
      : tractionProfile.patentStatus === 'filed' && uploadedDocuments.has('patent_proof')
        ? 40
        : 0;
  const itrFiling =
    tractionProfile.hasItrFiling && uploadedDocuments.has('itr_filing') ? 40 : 0;
  const revenueProof =
    tractionProfile.hasRevenueProof && uploadedDocuments.has('revenue_proof') ? 80 : 0;
  const revenueValidation = itrFiling + revenueProof;
  const grantsAndRecognition =
    (tractionProfile.hasGovernmentGrant && uploadedDocuments.has('grant_certificate')
      ? 40
      : 0) +
    (tractionProfile.hasAwardRecognition && uploadedDocuments.has('award_certificate')
      ? 20
      : 0);
  const fundingStatus =
    tractionProfile.fundingStatus === 'vc'
      ? uploadedDocuments.has('funding_proof')
        ? 60
        : 0
      : tractionProfile.fundingStatus === 'angel_seed'
        ? uploadedDocuments.has('funding_proof')
          ? 40
          : 0
        : tractionProfile.fundingStatus === 'bootstrapped'
          ? 20
          : 0;
  const tractionMetrics =
    calculateMetricScore(tractionProfile.activeUsersCustomers, [
      { min: 500, score: 30 },
      { min: 100, score: 25 },
      { min: 25, score: 15 },
      { min: 1, score: 5 },
    ]) +
    calculateMetricScore(tractionProfile.monthlyGrowthRate, [
      { min: 20, score: 20 },
      { min: 10, score: 15 },
      { min: 5, score: 10 },
      { min: 1, score: 5 },
    ]) +
    calculateMetricScore(tractionProfile.retentionRate, [
      { min: 60, score: 20 },
      { min: 40, score: 15 },
      { min: 20, score: 10 },
      { min: 1, score: 5 },
    ]);

  const companyTotal =
    legalStructure +
    cinNumber +
    governmentRecognition +
    companyDocumentation +
    portfolioPresence;
  const healthTotal =
    startupStage +
    innovationUniqueness +
    patentStrength +
    revenueValidation +
    grantsAndRecognition +
    fundingStatus +
    tractionMetrics;

  return {
    total: companyTotal + healthTotal,
    companyProfile: {
      total: companyTotal,
      legalStructure,
      cinNumber,
      governmentRecognition,
      companyDocumentation,
      portfolioPresence,
    },
    healthAndTraction: {
      total: healthTotal,
      startupStage,
      innovationUniqueness,
      patentStrength,
      revenueValidation,
      grantsAndRecognition,
      fundingStatus,
      tractionMetrics,
    },
  };
};
