import { ALLOWED_CONNECTIONS } from '../../middleware/connectionGuard';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';

type PublicUser = {
  _id: { toString(): string };
  displayName: string;
  avatar?: string;
  role: UserRole;
  domain?: string;
  bio?: string;
  lastLogin?: Date;
};

const mapPublicUser = (user: PublicUser) => ({
  _id: user._id.toString(),
  displayName: user.displayName,
  ...(user.avatar ? { avatar: user.avatar } : {}),
  role: user.role,
  ...(user.domain ? { domain: user.domain } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
});

export const listMarketplaceUsers = async (
  requesterRole: UserRole,
  role: UserRole,
  domain?: string,
  page = 1,
  limit = 20,
) => {
  if (!(ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(role)) {
    throw new ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${role}`);
  }

  const users = await User.find({
    role,
    isActive: true,
    ...(domain ? { domain: new RegExp(domain, 'i') } : {}),
  })
    .select('displayName avatar role domain bio lastLogin')
    .sort({ lastLogin: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return users.map((user) => mapPublicUser(user as PublicUser));
};

export const getMarketplaceUser = async (requesterRole: UserRole, userId: string) => {
  const user = await User.findById(userId)
    .select('displayName avatar role domain bio')
    .lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (!(ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(user.role)) {
    throw new ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${user.role}`);
  }

  return mapPublicUser(user as PublicUser);
};
