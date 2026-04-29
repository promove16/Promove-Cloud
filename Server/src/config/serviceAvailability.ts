import { env } from './env';

export type ServiceKey =
  | 'api'
  | 'mongodb'
  | 'redis'
  | 'auth_session_store'
  | 'bullmq'
  | 'email'
  | 'file_storage';

type EnvironmentMode = 'development' | 'test' | 'production';

type ServicePolicy = {
  mode: EnvironmentMode;
  service: ServiceKey;
  serviceName: string;
  required: boolean;
  supportEmail: string;
};

const SERVICE_NAMES: Record<ServiceKey, string> = {
  api: 'API service',
  mongodb: 'MongoDB',
  redis: 'Redis',
  auth_session_store: 'Authentication session store',
  bullmq: 'Background jobs',
  email: 'Email service',
  file_storage: 'File storage',
};

const hasEmailConfig = () =>
  env.MAIL_TRANSPORT === 'json' ||
  Boolean(env.SMTP_HOST || env.EMAIL_USER || (env.AWS_REGION && env.FROM_EMAIL));

const hasFileStorageConfig = () =>
  Boolean(
    env.CLOUDINARY_CLOUD_NAME ||
      (env.AWS_REGION && env.AWS_S3_BUCKET_NAME),
  );

export const getServicePolicy = (service: ServiceKey): ServicePolicy => {
  const mode = env.NODE_ENV;

  if (service === 'auth_session_store') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: !env.AUTH_ALLOW_REDIS_AUTH_FALLBACK,
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  if (mode === 'test') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: service === 'mongodb',
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  if (mode === 'development') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: service === 'mongodb',
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  if (service === 'bullmq') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: env.BULLMQ_USE_REDIS,
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  if (service === 'email') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: hasEmailConfig(),
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  if (service === 'file_storage') {
    return {
      mode,
      service,
      serviceName: SERVICE_NAMES[service],
      required: hasFileStorageConfig(),
      supportEmail: env.SUPPORT_EMAIL,
    };
  }

  return {
    mode,
    service,
    serviceName: SERVICE_NAMES[service],
    required: true,
    supportEmail: env.SUPPORT_EMAIL,
  };
};

export const shouldFailOpenForService = (service: ServiceKey) =>
  !getServicePolicy(service).required;

export const getServiceUnavailableDetails = (service: ServiceKey, message?: string) => {
  const policy = getServicePolicy(service);

  return [
    {
      service: policy.service,
      serviceName: policy.serviceName,
      supportEmail: policy.supportEmail,
      degraded: !policy.required,
      message:
        message ??
        `${policy.serviceName} is temporarily unavailable. Please contact ${policy.supportEmail}.`,
    },
  ];
};
