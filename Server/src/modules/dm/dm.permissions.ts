import { Types } from 'mongoose';
import { ALLOWED_CONNECTIONS } from '../../middleware/connectionGuard';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { Deal } from '../deal/deal.model';
import { DirectMessage, QueryType } from './dm.model';
import { MentorSession } from '../mentor/mentorSession.model';
import { RelevanceBridge } from '../recruiter/relevanceBridge.model';
import { RequestRecord } from '../request/request.model';
import { Settings } from '../settings/settings.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';

type MessagingUser = {
  _id: Types.ObjectId;
  role: UserRole;
  isActive: boolean;
  discoverableToRecruiters?: boolean;
};

type DmAccessContext = {
  sender: MessagingUser;
  recipient: MessagingUser;
  hasExistingConversation: boolean;
};

type DmAccessOptions = {
  allowConnectionRequest?: boolean;
};

const specificQueryTypeRules: Partial<Record<QueryType, { senderRoles?: UserRole[]; recipientRoles: UserRole[] }>> = {
  project_mentor: {
    senderRoles: [UserRole.STUDENT, UserRole.SCHOOL, UserRole.COLLEGE],
    recipientRoles: [UserRole.MENTOR],
  },
  project_join: {
    senderRoles: [UserRole.STUDENT],
    recipientRoles: [UserRole.STUDENT],
  },
  investor: {
    senderRoles: [UserRole.STUDENT],
    recipientRoles: [UserRole.INVESTOR],
  },
  recruiter: {
    senderRoles: [UserRole.STUDENT],
    recipientRoles: [UserRole.RECRUITER],
  },
  hiring_event: {
    senderRoles: [UserRole.RECRUITER],
    recipientRoles: [UserRole.COLLEGE],
  },
  mentorship_program: {
    senderRoles: [UserRole.MENTOR],
    recipientRoles: [UserRole.SCHOOL, UserRole.COLLEGE],
  },
};

const ensureParticipant = async (userId: string) => {
  const user = await User.findById(userId)
    .select('_id role isActive discoverableToRecruiters')
    .lean<MessagingUser | null>();

  if (!user || !user.isActive) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return user;
};

const hasConversation = async (leftUserId: string, rightUserId: string) => {
  const [leftId, rightId] = [new Types.ObjectId(leftUserId), new Types.ObjectId(rightUserId)];

  return Boolean(
    await DirectMessage.exists({
      $or: [
        { senderId: leftId, recipientId: rightId },
        { senderId: rightId, recipientId: leftId },
      ],
    }),
  );
};

const hasRecruiterStudentRelationship = async (recruiterId: string, studentId: string) => {
  const [bridge, student] = await Promise.all([
    RelevanceBridge.exists({
      recruiterId,
      studentId,
      isActive: true,
    }),
    User.findOne({
      _id: studentId,
      role: UserRole.STUDENT,
      isActive: true,
    })
      .select('_id discoverableToRecruiters')
      .lean<{ _id: Types.ObjectId; discoverableToRecruiters?: boolean } | null>(),
  ]);

  return Boolean(bridge || student?.discoverableToRecruiters);
};

const hasMentorStudentRelationship = async (mentorId: string, studentId: string) => {
  const [workspaceAssignment, sessionAssignment, launchedStartup] = await Promise.all([
    Workspace.exists({
      isActive: true,
      chatParticipants: {
        $elemMatch: {
          userId: new Types.ObjectId(mentorId),
          role: 'mentor',
        },
      },
      $or: [{ ownerId: new Types.ObjectId(studentId) }, { teamMemberIds: new Types.ObjectId(studentId) }],
    }),
    MentorSession.exists({
      mentorId: new Types.ObjectId(mentorId),
      studentId: new Types.ObjectId(studentId),
    }),
    Startup.exists({
      isActive: true,
      launchedToMentors: true,
      founderIds: new Types.ObjectId(studentId),
    }),
  ]);

  return Boolean(workspaceAssignment || sessionAssignment || launchedStartup);
};

const hasInvestorStudentRelationship = async (investorId: string, studentId: string) =>
  Boolean(
    await Deal.exists({
      investorId: new Types.ObjectId(investorId),
      studentId: new Types.ObjectId(studentId),
      status: { $ne: 'cancelled' },
    }),
  );

const hasAcceptedConversationRequest = async (userIdA: string, userIdB: string) => {
  const [idA, idB] = [new Types.ObjectId(userIdA), new Types.ObjectId(userIdB)];
  return Boolean(
    await RequestRecord.exists({
      status: 'accepted',
      $or: [
        { fromUserId: idA, toUserId: idB },
        { fromUserId: idB, toUserId: idA },
      ],
    }),
  );
};

const hasConversationRequest = async (userIdA: string, userIdB: string) => {
  const [idA, idB] = [new Types.ObjectId(userIdA), new Types.ObjectId(userIdB)];
  return Boolean(
    await RequestRecord.exists({
      $or: [
        { fromUserId: idA, toUserId: idB },
        { fromUserId: idB, toUserId: idA },
      ],
    }),
  );
};

const hasAllowedRolePair = (senderRole: UserRole, recipientRole: UserRole) =>
  (ALLOWED_CONNECTIONS[senderRole] ?? []).includes(recipientRole);

const recipientAllowsFirstContact = async (
  sender: MessagingUser,
  recipient: MessagingUser,
  allowConnectionRequest = false,
) => {
  if (sender.role === UserRole.ADMIN || recipient.role === UserRole.ADMIN) {
    return true;
  }

  const settings = await Settings.findOne({ userId: recipient._id })
    .select('privacy.allowDMs')
    .lean<{ privacy?: { allowDMs?: 'all' | 'connections' | 'none' } } | null>();
  const allowDMs = settings?.privacy?.allowDMs ?? 'all';

  if (allowDMs === 'none') {
    return false;
  }

  if (allowDMs === 'connections') {
    if (allowConnectionRequest) {
      return true;
    }

    return hasAcceptedConversationRequest(String(sender._id), String(recipient._id));
  }

  return true;
};

const matchesSpecificQueryRule = (queryType: QueryType, senderRole: UserRole, recipientRole: UserRole) => {
  if (queryType === 'general') {
    return true;
  }

  const rule = specificQueryTypeRules[queryType];
  if (!rule) {
    return false;
  }

  const senderAllowed = !rule.senderRoles || rule.senderRoles.includes(senderRole);
  return senderAllowed && rule.recipientRoles.includes(recipientRole);
};

const canOpenGeneralFirstContactChannel = async (sender: MessagingUser, recipient: MessagingUser) => {
  if (sender.role === UserRole.ADMIN || recipient.role === UserRole.ADMIN) {
    return true;
  }

  if (!hasAllowedRolePair(sender.role, recipient.role)) {
    return false;
  }

  if (sender.role === UserRole.STUDENT) {
    return recipient.role !== UserRole.STUDENT;
  }

  if (sender.role === UserRole.RECRUITER && recipient.role === UserRole.STUDENT) {
    return hasRecruiterStudentRelationship(String(sender._id), String(recipient._id));
  }

  if (sender.role === UserRole.MENTOR && recipient.role === UserRole.STUDENT) {
    return hasMentorStudentRelationship(String(sender._id), String(recipient._id));
  }

  if (sender.role === UserRole.INVESTOR && recipient.role === UserRole.STUDENT) {
    return hasInvestorStudentRelationship(String(sender._id), String(recipient._id));
  }

  return true;
};

const canInitiateSpecificFirstContact = async (
  sender: MessagingUser,
  recipient: MessagingUser,
  queryType: QueryType,
) => {
  if (!matchesSpecificQueryRule(queryType, sender.role, recipient.role)) {
    return false;
  }

  if (queryType === 'project_join') {
    return sender.role === UserRole.STUDENT && recipient.role === UserRole.STUDENT;
  }

  if (queryType === 'investor') {
    return sender.role === UserRole.STUDENT && recipient.role === UserRole.INVESTOR;
  }

  if (queryType === 'recruiter') {
    return sender.role === UserRole.STUDENT && recipient.role === UserRole.RECRUITER;
  }

  if (queryType === 'project_mentor') {
    return recipient.role === UserRole.MENTOR;
  }

  if (queryType === 'hiring_event') {
    return sender.role === UserRole.RECRUITER && recipient.role === UserRole.COLLEGE;
  }

  if (queryType === 'mentorship_program') {
    return sender.role === UserRole.MENTOR && [UserRole.SCHOOL, UserRole.COLLEGE].includes(recipient.role);
  }

  return false;
};

const canInitiateFirstContact = async (
  sender: MessagingUser,
  recipient: MessagingUser,
  queryType: QueryType,
  options: DmAccessOptions = {},
) => {
  if (sender.role === UserRole.ADMIN || recipient.role === UserRole.ADMIN) {
    return true;
  }

  if (!(await recipientAllowsFirstContact(sender, recipient, options.allowConnectionRequest))) {
    return false;
  }

  if (queryType !== 'general') {
    return canInitiateSpecificFirstContact(sender, recipient, queryType);
  }

  if (!hasAllowedRolePair(sender.role, recipient.role)) {
    return false;
  }

  return canOpenGeneralFirstContactChannel(sender, recipient);
};

const buildAccessContext = async (senderId: string, recipientId: string): Promise<DmAccessContext> => {
  const [sender, recipient, existingConversation] = await Promise.all([
    ensureParticipant(senderId),
    ensureParticipant(recipientId),
    hasConversation(senderId, recipientId),
  ]);

  return {
    sender,
    recipient,
    hasExistingConversation: existingConversation,
  };
};

export const ensureDmAccess = async (
  senderId: string,
  recipientId: string,
  queryType: QueryType = 'general',
  options: DmAccessOptions = {},
) => {
  const context = await buildAccessContext(senderId, recipientId);

  if (String(context.sender._id) === String(context.recipient._id)) {
    throw new ApiError(400, 'SELF_MESSAGE', 'You cannot send a message to yourself');
  }

  if (context.hasExistingConversation) {
    return context;
  }

  if (await hasAcceptedConversationRequest(senderId, recipientId)) {
    return context;
  }

  if (await canInitiateFirstContact(context.sender, context.recipient, queryType, options)) {
    return context;
  }

  throw new ApiError(403, 'DM_PERMISSION_DENIED', 'You do not have permission to contact this user');
};

export const ensureDmThreadAccess = async (viewerId: string, partnerId: string) => {
  const context = await buildAccessContext(viewerId, partnerId);

  if (String(context.sender._id) === String(context.recipient._id)) {
    throw new ApiError(400, 'SELF_MESSAGE', 'You cannot open a conversation with yourself');
  }

  if (context.hasExistingConversation) {
    return context;
  }

  if (await hasConversationRequest(viewerId, partnerId)) {
    return context;
  }

  if (await hasAcceptedConversationRequest(viewerId, partnerId)) {
    return context;
  }

  const generalAllowed = await canOpenGeneralFirstContactChannel(context.sender, context.recipient);
  const specificAllowed = (
    await Promise.all(
      (Object.keys(specificQueryTypeRules) as QueryType[]).map((queryType) =>
        canInitiateSpecificFirstContact(context.sender, context.recipient, queryType),
      ),
    )
  ).some(Boolean);

  const allowed = generalAllowed || specificAllowed;
  if (!allowed) {
    throw new ApiError(
      403,
      'DM_PERMISSION_DENIED',
      'You do not have permission to access this conversation',
    );
  }

  return context;
};

export const canSearchUserForDm = async (senderId: string, candidateId: string) => {
  try {
    const context = await buildAccessContext(senderId, candidateId);

    if (String(context.sender._id) === String(context.recipient._id)) {
      return false;
    }

    if (context.hasExistingConversation) {
      return true;
    }

    if (await canOpenGeneralFirstContactChannel(context.sender, context.recipient)) {
      return recipientAllowsFirstContact(context.sender, context.recipient);
    }

    if (!(await recipientAllowsFirstContact(context.sender, context.recipient))) {
      return false;
    }

    return (await Promise.all(
      (Object.keys(specificQueryTypeRules) as QueryType[]).map((queryType) =>
        canInitiateSpecificFirstContact(context.sender, context.recipient, queryType),
      ),
    )).some(Boolean);
  } catch {
    return false;
  }
};
