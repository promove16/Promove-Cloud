import { AuthUser } from '../types/auth.types';
import { UserRole } from '../types/roles.types';
import { roleRedirect } from './roleRedirect';

const canShowGithubProofFlow = (user: AuthUser) =>
  user.role === UserRole.STUDENT &&
  user.githubOAuthAvailable &&
  user.verificationStatus === 'verified' &&
  !user.connectedAccounts?.github?.userId;

export const getPostLoginRedirect = (user: AuthUser) =>
  canShowGithubProofFlow(user) ? '/dashboard/student?onboarding=proof' : roleRedirect(user.role);
