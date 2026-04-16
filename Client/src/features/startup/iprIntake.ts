import type {
  StartupBusinessModelType,
  StartupCommercializationStrategy,
  StartupDocumentCategory,
  StartupInitializationProfile,
  StartupInnovationStage,
  StartupIpProtectionType,
  StartupInventorOwnership,
  StartupLegalEntityType,
  StartupRegistrationProfile,
  StartupReadiness,
} from '../../types/startup.types';

export const STARTUP_INIT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

type InitSelectOption<T extends string> = {
  value: T;
  label: string;
};

type InitQuestionConfig =
  | {
      key: keyof StartupInitializationProfile;
      label: string;
      minLength: number;
      type?: 'textarea';
      options?: never;
    }
  | {
      key: keyof StartupInitializationProfile;
      label: string;
      type: 'select';
      options: readonly InitSelectOption<string>[];
      minLength?: never;
    };

type InitQuestionSection = {
  title: string;
  questions: readonly InitQuestionConfig[];
};

export const STARTUP_INIT_PRODUCT_STAGE_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
  { value: 'market_ready', label: 'Market-ready' },
] as const satisfies readonly InitSelectOption<StartupInnovationStage>[];

export const STARTUP_INIT_LEGAL_ENTITY_OPTIONS = [
  { value: 'not_registered', label: 'Not registered yet' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited (Pvt Ltd)' },
  { value: 'public_limited', label: 'Public Limited' },
] as const satisfies readonly InitSelectOption<StartupLegalEntityType>[];

export const STARTUP_INIT_BUSINESS_MODEL_OPTIONS = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'services', label: 'Services' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'hybrid', label: 'Hybrid' },
] as const satisfies readonly InitSelectOption<StartupBusinessModelType>[];

export const DEFAULT_STARTUP_INIT_PROFILE: StartupInitializationProfile = {
  vision: '',
  mission: '',
  foundingStory: '',
  teamComposition: '',
  productStage: 'idea',
  productOverview: '',
  customerProfile: '',
  marketOpportunity: '',
  businessModel: 'transactional',
  pricingStrategy: '',
  competitiveLandscape: '',
  defensibleMoat: '',
  currentTraction: '',
  upcomingMilestones: '',
  fundingAsk: '',
  legalEntityType: 'not_registered',
  risksAndMitigation: '',
};

export const STARTUP_INIT_QUESTION_SECTIONS: readonly InitQuestionSection[] = [
  {
    title: 'Vision & Mission',
    questions: [
      {
        key: 'vision',
        label: 'What is the long-term vision for this startup?',
        minLength: 30,
      },
      {
        key: 'mission',
        label: 'What is the mission that drives this startup?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Origins & Team',
    questions: [
      {
        key: 'foundingStory',
        label: 'Share the founding story - how and why did this startup begin?',
        minLength: 40,
      },
      {
        key: 'teamComposition',
        label: 'Describe your team composition and key roles.',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Product & Stage',
    questions: [
      {
        key: 'productStage',
        label: 'What is the current product stage?',
        type: 'select',
        options: STARTUP_INIT_PRODUCT_STAGE_OPTIONS,
      },
      {
        key: 'productOverview',
        label: 'Provide an overview of your product or service.',
        minLength: 30,
      },
    ],
  },
  {
    title: 'Customers & Market',
    questions: [
      {
        key: 'customerProfile',
        label: 'Describe your target customer profile.',
        minLength: 20,
      },
      {
        key: 'marketOpportunity',
        label: 'What is the market opportunity and size?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Business Model',
    questions: [
      {
        key: 'businessModel',
        label: 'What is your business model?',
        type: 'select',
        options: STARTUP_INIT_BUSINESS_MODEL_OPTIONS,
      },
      {
        key: 'pricingStrategy',
        label: 'Describe your pricing strategy.',
        minLength: 15,
      },
    ],
  },
  {
    title: 'Competition & Moat',
    questions: [
      {
        key: 'competitiveLandscape',
        label: 'Describe the competitive landscape.',
        minLength: 20,
      },
      {
        key: 'defensibleMoat',
        label: 'What is your defensible competitive advantage or moat?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Traction & Milestones',
    questions: [
      {
        key: 'currentTraction',
        label: 'What is your current traction (users, revenue, partnerships)?',
        minLength: 15,
      },
      {
        key: 'upcomingMilestones',
        label: 'What are your upcoming milestones for the next 6 months?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Funding & Legal',
    questions: [
      {
        key: 'fundingAsk',
        label: 'What is your funding ask and how will you use it?',
        minLength: 15,
      },
      {
        key: 'legalEntityType',
        label: 'What is your current legal entity status?',
        type: 'select',
        options: STARTUP_INIT_LEGAL_ENTITY_OPTIONS,
      },
      {
        key: 'risksAndMitigation',
        label: 'What are the key risks and your mitigation strategies?',
        minLength: 20,
      },
    ],
  },
] as const;

export const STARTUP_INIT_QUESTION_LABELS = Object.fromEntries(
  STARTUP_INIT_QUESTION_SECTIONS.flatMap((section) =>
    section.questions.map((question) => [question.key, question.label]),
  ),
) as Record<keyof StartupInitializationProfile, string>;

export const STARTUP_INIT_VALUE_LABELS: Partial<Record<keyof StartupInitializationProfile, Record<string, string>>> = {
  productStage: Object.fromEntries(
    STARTUP_INIT_PRODUCT_STAGE_OPTIONS.map((option) => [option.value, option.label]),
  ),
  businessModel: Object.fromEntries(
    STARTUP_INIT_BUSINESS_MODEL_OPTIONS.map((option) => [option.value, option.label]),
  ),
  legalEntityType: Object.fromEntries(
    STARTUP_INIT_LEGAL_ENTITY_OPTIONS.map((option) => [option.value, option.label]),
  ),
};

export const formatStartupInitValue = (
  key: keyof StartupInitializationProfile,
  value: string,
) => STARTUP_INIT_VALUE_LABELS[key]?.[value] ?? value;

export const buildStartupInitReadiness = (startup: {
  name?: string;
  tagline?: string;
  category?: string;
  founderIds?: readonly unknown[];
  pitchDeckUrl?: string;
  documents?: readonly { category?: StartupDocumentCategory }[];
  initializationProfile?: StartupInitializationProfile;
}): StartupReadiness => {
  const missingItems: string[] = [];
  const documents = startup.documents ?? [];
  const uploadedDocumentCategories = Array.from(
    new Set(
      documents
        .map((document) => document.category)
        .filter((category): category is StartupDocumentCategory => Boolean(category)),
    ),
  );
  const uploadedCategorySet = new Set(uploadedDocumentCategories);
  const initProfile = startup.initializationProfile ?? DEFAULT_STARTUP_INIT_PROFILE;

  const addMissing = (condition: boolean, label: string) => {
    if (condition) {
      missingItems.push(label);
    }
  };

  addMissing(!startup.name?.trim(), 'startup name');
  addMissing(!startup.tagline?.trim(), 'startup tagline');
  addMissing(!startup.category?.trim(), 'startup category');
  addMissing((startup.founderIds?.length ?? 0) === 0, 'at least one founder');
  addMissing(initProfile.vision.trim().length < 30, 'vision');
  addMissing(initProfile.mission.trim().length < 20, 'mission');
  addMissing(initProfile.foundingStory.trim().length < 40, 'founding story');
  addMissing(initProfile.teamComposition.trim().length < 20, 'team composition');
  addMissing(!initProfile.productStage.trim(), 'product stage');
  addMissing(initProfile.productOverview.trim().length < 30, 'product overview');
  addMissing(initProfile.customerProfile.trim().length < 20, 'customer profile');
  addMissing(initProfile.marketOpportunity.trim().length < 20, 'market opportunity');
  addMissing(!initProfile.businessModel.trim(), 'business model');
  addMissing(initProfile.pricingStrategy.trim().length < 15, 'pricing strategy');
  addMissing(initProfile.competitiveLandscape.trim().length < 20, 'competitive landscape');
  addMissing(initProfile.defensibleMoat.trim().length < 20, 'defensible moat');
  addMissing(initProfile.currentTraction.trim().length < 15, 'current traction');
  addMissing(initProfile.upcomingMilestones.trim().length < 20, 'upcoming milestones');
  addMissing(initProfile.fundingAsk.trim().length < 15, 'funding ask');
  addMissing(!initProfile.legalEntityType.trim(), 'legal entity type');
  addMissing(initProfile.risksAndMitigation.trim().length < 20, 'risks and mitigation');
  addMissing(!startup.pitchDeckUrl && !uploadedCategorySet.has('business_plan'), 'business plan or pitch deck upload');

  return {
    isReviewReady: missingItems.length === 0,
    missingItems,
    requiredDocumentCategories: [],
    uploadedDocumentCategories,
  };
};

export const STARTUP_IPR_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

type IprSelectOption<T extends string> = {
  value: T;
  label: string;
};

type IprQuestionConfig =
  | {
      key: keyof StartupRegistrationProfile;
      label: string;
      minLength: number;
      type?: 'textarea';
      options?: never;
    }
  | {
      key: keyof StartupRegistrationProfile;
      label: string;
      type: 'select';
      options: readonly IprSelectOption<string>[];
      minLength?: never;
    };

type IprQuestionSection = {
  title: string;
  questions: readonly IprQuestionConfig[];
};

export const STARTUP_IPR_DEVELOPMENT_STAGE_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
  { value: 'market_ready', label: 'Market-ready' },
] as const satisfies readonly IprSelectOption<StartupInnovationStage>[];

export const STARTUP_IPR_OWNERSHIP_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'organization', label: 'Organization' },
] as const satisfies readonly IprSelectOption<StartupInventorOwnership>[];

export const STARTUP_IPR_COMMERCIALIZATION_OPTIONS = [
  { value: 'build_startup', label: 'Build startup' },
  { value: 'license', label: 'License' },
  { value: 'sell', label: 'Sell' },
  { value: 'partnership', label: 'Partnership' },
] as const satisfies readonly IprSelectOption<StartupCommercializationStrategy>[];

export const STARTUP_IPR_PROTECTION_OPTIONS = [
  { value: 'patent', label: 'Patent' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'design', label: 'Design' },
] as const satisfies readonly IprSelectOption<StartupIpProtectionType>[];

export const DEFAULT_STARTUP_IPR_PROFILE: StartupRegistrationProfile = {
  problemStatement: '',
  solutionDifferentiation: '',
  coreInnovation: '',
  priorArtStatus: '',
  workingMechanism: '',
  keyComponents: '',
  developmentStage: 'idea',
  documentationReadiness: '',
  inventorOwnership: 'individual',
  developmentContext: '',
  targetMarkets: '',
  commercializationStrategy: 'build_startup',
  publicDisclosureStatus: '',
  legalAgreements: '',
  ipProtectionType: 'patent',
};

export const STARTUP_IPR_QUESTION_SECTIONS: readonly IprQuestionSection[] = [
  {
    title: 'Innovation & Problem Clarity',
    questions: [
      {
        key: 'problemStatement',
        label:
          'What problem does your innovation solve, and who are the primary users or stakeholders affected by this problem?',
        minLength: 40,
      },
      {
        key: 'solutionDifferentiation',
        label: 'How is your solution different from existing solutions currently available in the market?',
        minLength: 40,
      },
    ],
  },
  {
    title: 'Novelty & Uniqueness',
    questions: [
      {
        key: 'coreInnovation',
        label: 'What is the core unique feature or innovation in your solution?',
        minLength: 30,
      },
      {
        key: 'priorArtStatus',
        label:
          'Have you conducted any prior art search or reviewed similar patents? If yes, please provide details or references.',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Technical Understanding',
    questions: [
      {
        key: 'workingMechanism',
        label: 'Explain the working mechanism or process flow of your innovation.',
        minLength: 40,
      },
      {
        key: 'keyComponents',
        label: 'What are the key components involved (hardware, software, process, or combination)?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Development Stage',
    questions: [
      {
        key: 'developmentStage',
        label: 'What is the current stage of your innovation?',
        type: 'select',
        options: STARTUP_IPR_DEVELOPMENT_STAGE_OPTIONS,
      },
      {
        key: 'documentationReadiness',
        label:
          'Do you have any prototypes, diagrams, or technical documentation ready? Mention what is available and use the upload slots below for supporting files.',
        minLength: 10,
      },
    ],
  },
  {
    title: 'Ownership & Rights',
    questions: [
      {
        key: 'inventorOwnership',
        label: 'Who are the inventors or creators of this innovation?',
        type: 'select',
        options: STARTUP_IPR_OWNERSHIP_OPTIONS,
      },
      {
        key: 'developmentContext',
        label: 'Was this innovation developed independently or under any institution, company, or funded program?',
        minLength: 20,
      },
    ],
  },
  {
    title: 'Commercial Potential',
    questions: [
      {
        key: 'targetMarkets',
        label: 'Which industries or markets can this innovation be applied to?',
        minLength: 20,
      },
      {
        key: 'commercializationStrategy',
        label: 'What is your intended commercialization strategy?',
        type: 'select',
        options: STARTUP_IPR_COMMERCIALIZATION_OPTIONS,
      },
    ],
  },
  {
    title: 'Confidentiality & Disclosure',
    questions: [
      {
        key: 'publicDisclosureStatus',
        label: 'Have you publicly disclosed this innovation anywhere?',
        minLength: 10,
      },
      {
        key: 'legalAgreements',
        label: 'Are there any existing Non-Disclosure Agreements (NDAs) or legal agreements related to this innovation?',
        minLength: 10,
      },
    ],
  },
  {
    title: 'Strategic Intent',
    questions: [
      {
        key: 'ipProtectionType',
        label: 'What type of intellectual property protection are you seeking?',
        type: 'select',
        options: STARTUP_IPR_PROTECTION_OPTIONS,
      },
    ],
  },
] as const;

export const STARTUP_IPR_QUESTION_LABELS = Object.fromEntries(
  STARTUP_IPR_QUESTION_SECTIONS.flatMap((section) =>
    section.questions.map((question) => [question.key, question.label]),
  ),
) as Record<keyof StartupRegistrationProfile, string>;

export const STARTUP_IPR_VALUE_LABELS: Partial<Record<keyof StartupRegistrationProfile, Record<string, string>>> = {
  developmentStage: Object.fromEntries(
    STARTUP_IPR_DEVELOPMENT_STAGE_OPTIONS.map((option) => [option.value, option.label]),
  ),
  inventorOwnership: Object.fromEntries(STARTUP_IPR_OWNERSHIP_OPTIONS.map((option) => [option.value, option.label])),
  commercializationStrategy: Object.fromEntries(
    STARTUP_IPR_COMMERCIALIZATION_OPTIONS.map((option) => [option.value, option.label]),
  ),
  ipProtectionType: Object.fromEntries(STARTUP_IPR_PROTECTION_OPTIONS.map((option) => [option.value, option.label])),
};

export const STARTUP_IPR_DOCUMENT_SPECS: Array<{
  category: StartupDocumentCategory;
  label: string;
  hint: string;
}> = [
  {
    category: 'technical_documentation',
    label: 'Technical documentation',
    hint: 'Prototype notes, architecture, technical write-up, or R&D documentation',
  },
  {
    category: 'prototype_documentation',
    label: 'Prototype evidence',
    hint: 'Prototype screenshots, demo photos, testing output, or MVP evidence',
  },
  {
    category: 'drawings_diagrams',
    label: 'Drawings or diagrams',
    hint: 'Block diagrams, system flowcharts, CAD views, or process maps',
  },
  {
    category: 'prior_art_search',
    label: 'Prior art search',
    hint: 'Search notes, similar patent references, or competitor review documents',
  },
  {
    category: 'design_plan_sketch',
    label: 'Design / plan / pen-paper sketch',
    hint: 'Hand-drawn sketches, concept sheets, layout plans, or paper mockups',
  },
] as const;

const startupDocumentLabels = Object.fromEntries(
  STARTUP_IPR_DOCUMENT_SPECS.map((spec) => [spec.category, spec.label]),
) as Partial<Record<StartupDocumentCategory, string>>;

export const getRequiredStartupDocumentCategories = (
  registrationProfile: StartupRegistrationProfile,
): StartupDocumentCategory[] =>
  registrationProfile.developmentStage === 'idea' ? ['design_plan_sketch'] : ['technical_documentation'];

export const buildStartupReviewReadiness = (startup: {
  name?: string;
  tagline?: string;
  category?: string;
  founderIds?: readonly unknown[];
  pitchDeckUrl?: string;
  documents?: readonly { category?: StartupDocumentCategory }[];
  registrationProfile?: StartupRegistrationProfile;
}): StartupReadiness => {
  const missingItems: string[] = [];
  const documents = startup.documents ?? [];
  const uploadedDocumentCategories = Array.from(
    new Set(
      documents
        .map((document) => document.category)
        .filter((category): category is StartupDocumentCategory => Boolean(category)),
    ),
  );
  const uploadedCategorySet = new Set(uploadedDocumentCategories);
  const registrationProfile = startup.registrationProfile ?? DEFAULT_STARTUP_IPR_PROFILE;
  const requiredDocumentCategories = getRequiredStartupDocumentCategories(registrationProfile);

  const addMissing = (condition: boolean, label: string) => {
    if (condition) {
      missingItems.push(label);
    }
  };

  addMissing(!startup.name?.trim(), 'startup name');
  addMissing(!startup.tagline?.trim(), 'startup tagline');
  addMissing(!startup.category?.trim(), 'startup category');
  addMissing((startup.founderIds?.length ?? 0) === 0, 'at least one founder');
  addMissing(registrationProfile.problemStatement.trim().length < 40, 'IPR problem statement');
  addMissing(registrationProfile.solutionDifferentiation.trim().length < 40, 'solution differentiation');
  addMissing(registrationProfile.coreInnovation.trim().length < 30, 'core innovation');
  addMissing(registrationProfile.priorArtStatus.trim().length < 20, 'prior art status');
  addMissing(registrationProfile.workingMechanism.trim().length < 40, 'working mechanism');
  addMissing(registrationProfile.keyComponents.trim().length < 20, 'key components');
  addMissing(!registrationProfile.developmentStage.trim(), 'innovation stage');
  addMissing(registrationProfile.documentationReadiness.trim().length < 10, 'documentation readiness');
  addMissing(!registrationProfile.inventorOwnership.trim(), 'inventor ownership');
  addMissing(registrationProfile.developmentContext.trim().length < 20, 'development context');
  addMissing(registrationProfile.targetMarkets.trim().length < 20, 'target markets');
  addMissing(!registrationProfile.commercializationStrategy.trim(), 'commercialization strategy');
  addMissing(registrationProfile.publicDisclosureStatus.trim().length < 10, 'public disclosure status');
  addMissing(registrationProfile.legalAgreements.trim().length < 10, 'legal agreements');
  addMissing(!registrationProfile.ipProtectionType.trim(), 'IP protection type');
  addMissing(!startup.pitchDeckUrl && !uploadedCategorySet.has('business_plan'), 'business plan or pitch deck upload');

  for (const category of requiredDocumentCategories) {
    addMissing(!uploadedCategorySet.has(category), startupDocumentLabels[category] ?? category.replace(/_/g, ' '));
  }

  return {
    isReviewReady: missingItems.length === 0,
    missingItems,
    requiredDocumentCategories,
    uploadedDocumentCategories,
  };
};

export const formatStartupIprValue = (
  key: keyof StartupRegistrationProfile,
  value: string,
) => STARTUP_IPR_VALUE_LABELS[key]?.[value] ?? value;
