export type NotificationType =
  | 'score_update'
  | 'team_invite'
  | 'chat_invite'
  | 'request'
  | 'patent_status'
  | 'deal_interest'
  | 'startup_launch'
  | 'system';

export interface NotificationItem {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: {
    dealId?: string;
    agreementId?: string;
    workspaceId?: string;
    startupId?: string;
    startupName?: string;
    reviewStatus?: string;
    adminId?: string;
    adminName?: string;
    adminNotes?: string;
    requestId?: string;
    requestType?: string;
    actionType?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    targetEntityTitle?: string;
    targetName?: string;
    requestedRole?: string;
    requestedPermission?: string;
    deepLink?: string;
    acceptRedirect?: string;
    declineRedirect?: string;
    workspaceTitle?: string;
    sender?: {
      _id: string;
      name?: string;
      displayName?: string;
      role?: string;
    };
  };
  isRead: boolean;
  createdAt: string;
}
