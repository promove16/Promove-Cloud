export type PlacementStatus =
  | 'Discovered'
  | 'Shortlisted'
  | 'Hired'
  | 'Rejected'
  | 'In Progress';

export interface HiringPartner {
  _id: string;
  displayName: string;
  avatar?: string;
  company: string;
  openPositions: number;
  activeDrives: number;
  domains: string[];
}

export interface PlacementRecordView {
  _id: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  recruiterId?: string;
  recruiterName?: string;
  companyName?: string;
  innovationScore: number;
  status: PlacementStatus;
  updatedAt: string;
}

export interface PlacementTrackerData {
  placementVelocity: number;
  totalInnovators: number;
  studentsPlaced: number;
  hiringPartners: HiringPartner[];
  placementTable: PlacementRecordView[];
}
