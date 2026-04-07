import { QueryType } from '../../api/dm.api';

export type AssociationQueryType = Extract<
  QueryType,
  'project_mentor' | 'project_join' | 'investor' | 'recruiter' | 'hiring_event' | 'mentorship_program'
>;

type AssociationRule = {
  recipientRoles: string[];
  senderRoles?: string[];
};

const associationRoleMap: Record<AssociationQueryType, AssociationRule> = {
  project_mentor: { recipientRoles: ['mentor'] },
  project_join: { recipientRoles: ['student'] },
  investor: { recipientRoles: ['investor'] },
  recruiter: { recipientRoles: ['recruiter'] },
  hiring_event: { recipientRoles: ['college'], senderRoles: ['recruiter'] },
  mentorship_program: { recipientRoles: ['school', 'college'], senderRoles: ['mentor'] },
};

export const normalizeMessagingRole = (role?: string | null) => {
  const normalizedRole = role?.trim().toLowerCase();

  if (!normalizedRole) return '';
  if (normalizedRole === 'company') return 'recruiter';

  return normalizedRole;
};

export const isAssociationQueryType = (queryType: QueryType): queryType is AssociationQueryType =>
  queryType === 'project_mentor' ||
  queryType === 'project_join' ||
  queryType === 'investor' ||
  queryType === 'recruiter' ||
  queryType === 'hiring_event' ||
  queryType === 'mentorship_program';

export const getVisibleAssociationQueryTypes = (
  recipientRole?: string | null,
  senderRole?: string | null,
): AssociationQueryType[] => {
  const normalizedRole = normalizeMessagingRole(recipientRole);
  const normalizedSenderRole = normalizeMessagingRole(senderRole);

  return (Object.keys(associationRoleMap) as AssociationQueryType[]).filter((queryType) => {
    const rule = associationRoleMap[queryType];
    const recipientAllowed = rule.recipientRoles.includes(normalizedRole);
    const senderAllowed = !rule.senderRoles || rule.senderRoles.includes(normalizedSenderRole);

    return recipientAllowed && senderAllowed;
  });
};
