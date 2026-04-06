import { QueryType } from '../../api/dm.api';

export type AssociationQueryType = Extract<QueryType, 'project_mentor' | 'project_join' | 'investor' | 'recruiter'>;

const associationRoleMap: Record<AssociationQueryType, string[]> = {
  project_mentor: ['mentor'],
  project_join: ['student'],
  investor: ['investor'],
  recruiter: ['recruiter'],
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
  queryType === 'recruiter';

export const getVisibleAssociationQueryTypes = (recipientRole?: string | null): AssociationQueryType[] => {
  const normalizedRole = normalizeMessagingRole(recipientRole);

  return (Object.keys(associationRoleMap) as AssociationQueryType[]).filter((queryType) =>
    associationRoleMap[queryType].includes(normalizedRole),
  );
};
