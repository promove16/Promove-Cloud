export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired' | 'cancelled' | 'completed';

export type RequestType =
  | 'generic'
  | 'workspace_member'
  | 'workspace_chat_access'
  | 'startup_member'
  | 'startup_cofounder'
  | 'mentor_assignment'
  | 'investor_startup_access'
  | 'recruiter_job_invite'
  | 'campus_drive_registration'
  | 'college_event_invite'
  | 'college_recruiter_partnership'
  | 'patent_coinventor'
  | 'problem_review'
  | 'startup_review'
  | 'patent_request_review';

export type RequestActionType =
  | 'join'
  | 'collaborate'
  | 'mentor'
  | 'invest'
  | 'review'
  | 'approve'
  | 'register'
  | 'shortlist'
  | 'hire'
  | 'access_chat'
  | 'access_private_details'
  | 'co_invent'
  | 'partner'
  | 'assign'
  | 'connect';

export interface RequestUserSummary {
  _id: string;
  displayName: string;
  email?: string;
  role?: string;
  avatar?: string;
  domain?: string;
  verificationStatus?: string;
  adminApprovalStatus?: string;
}

export interface WorkflowRequest {
  _id: string;
  type: RequestType;
  requestType: RequestType;
  actionType?: RequestActionType;
  fromUserId: string;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityTitle?: string;
  targetRole?: string;
  requestedRole?: string;
  requestedPermission?: string;
  status: RequestStatus;
  message?: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt: string;
  respondedAt?: string;
  auditTrail?: Array<{
    status: RequestStatus | 'created';
    actorUserId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
    at: string;
  }>;
  createdAt: string;
  updatedAt: string;
  fromUser?: RequestUserSummary;
  toUser?: RequestUserSummary;
}
