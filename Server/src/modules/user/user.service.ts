import { z } from 'zod';
import { User } from './user.model';
import { IUser, SanitizedUser } from './user.types';
import { ApiError } from '../../utils/ApiError';

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatar: z.string().trim().url().optional().or(z.literal('')),
    bio: z.string().trim().max(500).optional().or(z.literal('')),
    domain: z.string().trim().max(120).optional().or(z.literal('')),
    profileComplete: z.boolean().optional(),
    discoverableToRecruiters: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

type UserLike = Omit<IUser, '_id' | 'institutionId'> & {
  _id: { toString(): string };
  institutionId?: { toString(): string };
};

export const toSanitizedUser = (user: UserLike): SanitizedUser => ({
  _id: user._id.toString(),
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  ...(user.avatar ? { avatar: user.avatar } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
  ...(user.domain ? { domain: user.domain } : {}),
  profileComplete: user.profileComplete,
  innovationScore: user.innovationScore,
  scoreBreakdown: user.scoreBreakdown,
  accessGrantedBy: user.accessGrantedBy,
  accessExpiresAt: user.accessExpiresAt,
  isActive: user.isActive,
  ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
  discoverableToRecruiters: user.discoverableToRecruiters ?? false,
  ...(user.institutionId ? { institutionId: user.institutionId.toString() } : {}),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toSanitizedUser(user as UserLike);
};

export const updateCurrentUser = async (
  userId: string,
  payload: z.infer<typeof updateMeSchema>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (payload.displayName !== undefined) {
    user.displayName = payload.displayName;
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar || undefined;
  }

  if (payload.bio !== undefined) {
    user.bio = payload.bio || undefined;
  }

  if (payload.domain !== undefined) {
    user.domain = payload.domain || undefined;
  }

  if (payload.profileComplete !== undefined) {
    user.profileComplete = payload.profileComplete;
  }

  if (payload.discoverableToRecruiters !== undefined) {
    user.discoverableToRecruiters = payload.discoverableToRecruiters;
  }

  await user.save();

  return toSanitizedUser(user.toObject() as UserLike);
};
