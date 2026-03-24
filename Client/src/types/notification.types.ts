export type NotificationType =
  | 'score_update'
  | 'team_invite'
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
  isRead: boolean;
  createdAt: string;
}
