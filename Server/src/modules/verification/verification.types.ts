export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected', 'suspended'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const STARTUP_VERIFICATION_STATUSES = ['draft', 'review_requested', 'changes_requested', 'approved', 'rejected'] as const;
export type StartupVerificationStatus = (typeof STARTUP_VERIFICATION_STATUSES)[number];

export const FRAUD_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export type FraudSeverity = (typeof FRAUD_SEVERITY)[number];

export interface FraudFlag {
  type: string;
  severity: FraudSeverity;
  description: string;
  evidence?: string[];
  detectedAt: Date;
  clearedAt?: Date;
  clearedBy?: string;
  clearanceNote?: string;
}
