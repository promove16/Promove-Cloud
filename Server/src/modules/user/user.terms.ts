import { UserRole } from '../../types/roles.types';
import { TermsAcceptance } from './user.types';

export const CURRENT_TERMS_VERSION = '2026-04-06';

export const hasAcceptedCurrentTerms = (
  role: UserRole,
  termsAcceptance?: TermsAcceptance | null,
) => role === UserRole.ADMIN || termsAcceptance?.version === CURRENT_TERMS_VERSION;

export const buildTermsAcceptance = (role: UserRole): TermsAcceptance => ({
  version: CURRENT_TERMS_VERSION,
  acceptedAt: new Date(),
  sector: role,
});
