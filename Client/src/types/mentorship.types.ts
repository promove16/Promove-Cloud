export interface InstitutionMentorshipProgram {
  _id: string;
  institution: {
    _id: string;
    displayName: string;
    type: 'school' | 'college';
    location?: string;
    locations?: string[];
  };
  requestedBy: {
    _id: string;
    displayName: string;
    email: string;
  };
  mentor?: {
    _id: string;
    displayName: string;
    email: string;
    avatar?: string;
    domain?: string;
    bio?: string;
  };
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt?: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  preferredExpertise?: string;
  adminNotes?: string;
  rejectionReason?: string;
  status: 'Pending' | 'Assigned' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionMentorshipProgramStats {
  total: number;
  pending: number;
  assigned: number;
  rejected: number;
}

export interface InstitutionMentorshipProgramView {
  items: InstitutionMentorshipProgram[];
  stats: InstitutionMentorshipProgramStats;
}

export interface CreateInstitutionMentorshipProgramInput {
  title: string;
  objective: string;
  preferredDate: string;
  durationMinutes: number;
  expectedParticipants: number;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink?: string;
  venue?: string;
  preferredExpertise?: string;
}

export interface AdminCreateMentorshipProgramInput extends CreateInstitutionMentorshipProgramInput {
  institutionId: string;
  mentorId: string;
  scheduledAt: string;
  adminNotes?: string;
}

export interface AdminMentorListItem {
  _id: string;
  displayName: string;
  email: string;
  avatar?: string;
  domain?: string;
  bio?: string;
  headline?: string;
  assignedProjects: number;
  assignedPrograms: number;
  createdAt: string;
}

export interface CreateMentorProfileInput {
  displayName: string;
  email: string;
  domain?: string;
  bio?: string;
  headline?: string;
}

export interface CreatedMentorProfileResult {
  mentor: AdminMentorListItem;
  temporaryPassword: string;
}

export type ReviewMentorshipProgramInput =
  | {
      decision: 'assigned';
      mentorId: string;
      scheduledAt: string;
      deliveryMode: 'Online' | 'Offline';
      platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
      meetingLink?: string;
      venue?: string;
      adminNotes?: string;
    }
  | {
      decision: 'rejected';
      rejectionReason: string;
      adminNotes?: string;
    };
