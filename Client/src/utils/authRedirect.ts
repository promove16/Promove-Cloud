type LoginRedirectOptions = {
  message?: "auth_required" | "session_expired";
  next?: string | null;
  intent?: string | null;
};

export const sanitizeNextPath = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  return normalized;
};

export const buildLoginRedirectPath = ({
  message = "auth_required",
  next,
  intent,
}: LoginRedirectOptions = {}) => {
  const params = new URLSearchParams();
  const safeNext = sanitizeNextPath(next);
  const safeIntent = intent?.trim();

  params.set("message", message);

  if (safeNext) {
    params.set("next", safeNext);
  }

  if (safeIntent) {
    params.set("intent", safeIntent);
  }

  return `/login?${params.toString()}`;
};
