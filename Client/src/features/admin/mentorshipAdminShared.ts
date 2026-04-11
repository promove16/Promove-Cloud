import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { type AdminUserListItem } from '../../api/admin.api';

export type MentorFormState = {
  displayName: string;
  email: string;
  domain: string;
  bio: string;
  headline: string;
};

export type AssignmentDraft = {
  mentorId: string;
  scheduledAt: string;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink: string;
  venue: string;
  adminNotes: string;
};

export type ProgramFormState = {
  institutionType: 'school' | 'college';
  institutionId: string;
  mentorId: string;
  title: string;
  objective: string;
  preferredDate: string;
  scheduledAt: string;
  durationMinutes: string;
  expectedParticipants: string;
  deliveryMode: 'Online' | 'Offline';
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Offline';
  meetingLink: string;
  venue: string;
  preferredExpertise: string;
  adminNotes: string;
};

export const formLabelClassName =
  'mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400';

const allowedDateTimePickerKeys = new Set([
  'Tab',
  'Shift',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export const createPickerOnlyDateTimeInputHandlers = (clearValue: () => void) => ({
  inputMode: 'none' as const,
  step: 60,
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      clearValue();
      return;
    }

    if (!allowedDateTimePickerKeys.has(event.key)) {
      event.preventDefault();
    }
  },
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
  },
  onDrop: (event: DragEvent<HTMLInputElement>) => {
    event.preventDefault();
  },
});

export const emptyMentorForm = (): MentorFormState => ({
  displayName: '',
  email: '',
  domain: '',
  bio: '',
  headline: '',
});

export const emptyAssignmentDraft = (): AssignmentDraft => ({
  mentorId: '',
  scheduledAt: '',
  deliveryMode: 'Online',
  platform: 'Google Meet',
  meetingLink: '',
  venue: '',
  adminNotes: '',
});

export const emptyProgramForm = (): ProgramFormState => ({
  institutionType: 'school',
  institutionId: '',
  mentorId: '',
  title: '',
  objective: '',
  preferredDate: '',
  scheduledAt: '',
  durationMinutes: '60',
  expectedParticipants: '40',
  deliveryMode: 'Online',
  platform: 'Google Meet',
  meetingLink: '',
  venue: '',
  preferredExpertise: '',
  adminNotes: '',
});

export const getInstitutionLabel = (institution: AdminUserListItem) =>
  institution.institutionProfile?.institutionName ?? institution.displayName;
