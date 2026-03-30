export type OAuthProvider = 'google' | 'linkedin';

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  linkedin: 'LinkedIn',
};

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL ?? '/api';

const normalizeApiBaseUrl = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const apiPath = /\/api(?:\/|$)/i.test(pathname) ? pathname : `${pathname || ''}/api`;
    return `${parsed.origin}${apiPath}`;
  }

  if (trimmed.startsWith('/')) {
    return /\/api(?:\/|$)/i.test(trimmed) ? trimmed : `${trimmed}/api`;
  }

  return `/${trimmed || 'api'}`;
};

export const buildOAuthStartUrl = (provider: OAuthProvider) => {
  const apiBase = normalizeApiBaseUrl(getApiBaseUrl());
  return `${apiBase}/auth/oauth/${provider}`;
};

export const startOAuthLogin = (provider: OAuthProvider) => {
  window.location.assign(buildOAuthStartUrl(provider));
};

export const getOAuthErrorMessage = (
  provider: OAuthProvider | null,
  code?: string | null,
  message?: string | null,
) => {
  if (message?.trim()) {
    return message.trim();
  }

  switch (code) {
    case 'OAUTH_ACCESS_DENIED':
      return provider
        ? `You cancelled the ${OAUTH_PROVIDER_LABELS[provider]} sign-in request.`
        : 'You cancelled the sign-in request.';
    case 'OAUTH_STATE_EXPIRED':
    case 'INVALID_OAUTH_STATE':
      return 'Your sign-in session expired. Please try again.';
    case 'OAUTH_ACCOUNT_NOT_REGISTERED':
      return 'We could not find a ProMove account for that email address.';
    case 'OAUTH_EMAIL_NOT_VERIFIED':
      return 'Your provider email is not verified. Please verify it and try again.';
    case 'OAUTH_ACCOUNT_INACTIVE':
      return 'This account is currently inactive.';
    case 'ADMIN_APPROVAL_PENDING':
      return 'Your registration request is still waiting for admin approval.';
    case 'ADMIN_APPROVAL_REJECTED':
      return 'Your registration request was rejected. Please contact support.';
    case 'INSTITUTION_APPROVAL_PENDING':
      return 'Your institution has not approved your student account yet.';
    case 'INSTITUTION_VERIFICATION_REJECTED':
      return 'Your institution could not verify your account. Please contact them for support.';
    default:
      return provider
        ? `Unable to complete ${OAUTH_PROVIDER_LABELS[provider]} sign-in right now.`
        : 'Unable to complete sign-in right now.';
  }
};
