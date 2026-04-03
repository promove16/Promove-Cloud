import type {
  StartupCommercializationStrategy,
  StartupDocumentCategory,
  StartupInnovationStage,
  StartupIpProtectionType,
  StartupInventorOwnership,
  StartupRegistrationProfile,
} from '../../types/startup.types';

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

export const getRequiredStartupDocumentCategories = (
  registrationProfile: StartupRegistrationProfile,
): StartupDocumentCategory[] =>
  registrationProfile.developmentStage === 'idea' ? ['design_plan_sketch'] : ['technical_documentation'];

export const formatStartupIprValue = (
  key: keyof StartupRegistrationProfile,
  value: string,
) => STARTUP_IPR_VALUE_LABELS[key]?.[value] ?? value;
