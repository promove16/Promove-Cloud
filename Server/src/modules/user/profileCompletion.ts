import { IUser } from './user.types';

type ProfileCompletionSection = {
  key:
    | 'displayName'
    | 'avatar'
    | 'bio'
    | 'domain'
    | 'headline'
    | 'location'
    | 'links'
    | 'skills'
    | 'experience'
    | 'education'
    | 'portfolio';
  label: string;
  weight: number;
  complete: boolean;
};

type ProfileCompletionUser = Pick<
  IUser,
  | 'displayName'
  | 'avatar'
  | 'bio'
  | 'domain'
  | 'headline'
  | 'location'
  | 'websiteUrl'
  | 'githubUrl'
  | 'linkedinUrl'
  | 'skills'
  | 'experience'
  | 'education'
  | 'portfolioProjects'
  | 'resume'
>;

const hasText = (value?: string | null) => Boolean(value?.trim());

export const getProfileCompletionSections = (
  user: ProfileCompletionUser,
): ProfileCompletionSection[] => [
  { key: 'displayName', label: 'Display name', weight: 10, complete: hasText(user.displayName) },
  { key: 'avatar', label: 'Profile photo', weight: 10, complete: hasText(user.avatar) },
  { key: 'bio', label: 'Bio', weight: 15, complete: hasText(user.bio) },
  { key: 'domain', label: 'Domain or focus area', weight: 10, complete: hasText(user.domain) },
  { key: 'headline', label: 'Headline', weight: 10, complete: hasText(user.headline) },
  { key: 'location', label: 'Location', weight: 5, complete: hasText(user.location) },
  {
    key: 'links',
    label: 'Website or social links',
    weight: 10,
    complete: hasText(user.websiteUrl) || hasText(user.githubUrl) || hasText(user.linkedinUrl),
  },
  { key: 'skills', label: 'Skills', weight: 10, complete: (user.skills?.length ?? 0) > 0 },
  {
    key: 'experience',
    label: 'Experience',
    weight: 10,
    complete: (user.experience?.length ?? 0) > 0,
  },
  {
    key: 'education',
    label: 'Education',
    weight: 5,
    complete: (user.education?.length ?? 0) > 0,
  },
  {
    key: 'portfolio',
    label: 'Portfolio or resume',
    weight: 5,
    complete: (user.portfolioProjects?.length ?? 0) > 0 || hasText(user.resume?.fileUrl),
  },
];

export const getProfileCompletionProgress = (user: ProfileCompletionUser) => {
  const sections = getProfileCompletionSections(user);
  const percent = Math.min(
    100,
    sections.reduce((total, section) => total + (section.complete ? section.weight : 0), 0),
  );

  return {
    percent,
    sections,
    missingSections: sections.filter((section) => !section.complete),
  };
};
