const ROLES = require('./roles');

const PERMISSION_MAP = {
  [ROLES.STUDENT]: [
    'project:create', 'project:read', 'project:update:own', 'project:delete:own',
    'team:create', 'team:invite', 'team:read:own',
    'board:read:own', 'board:update:own',
    'ticket:create:own', 'ticket:read:own', 'ticket:update:own',
    'marketplace:read', 'marketplace:list:own',
    'pitch:create', 'pitch:read:own',
    'mentor:browse', 'mentor:request',
    'leaderboard:read', 'profile:read', 'profile:update:own',
  ],
  [ROLES.SCHOOL]: [
    'student:upload', 'student:verify', 'student:read:own',
    'event:create:own', 'event:read', 'event:update:own',
    'mentor:invite', 'leaderboard:read', 'profile:read',
  ],
  [ROLES.COLLEGE]: [
    'student:upload', 'student:verify', 'student:read:own', 'student:academic:manage',
    'hackathon:create', 'hackathon:manage:own',
    'event:create:own', 'event:read', 'event:update:own',
    'investor:onboard', 'marketplace:read', 'marketplace:promote',
    'mentor:invite', 'leaderboard:read', 'profile:read',
  ],
  [ROLES.INVESTOR]: [
    'project:read', 'marketplace:read', 'marketplace:save',
    'pitch:read:own', 'pitch:respond', 'pitch:schedule',
    'board:read:invested', 'leaderboard:read', 'profile:read',
  ],
  [ROLES.HR]: [
    'student:search', 'student:read:public', 'leaderboard:read',
    'event:create:own', 'interview:schedule', 'interview:manage:own',
    'campus_drive:create', 'campus_drive:manage:own', 'profile:read',
  ],
  [ROLES.MENTOR]: [
    'project:read:assigned', 'board:read:assigned', 'board:update:assigned',
    'ticket:create:assigned', 'ticket:update:assigned',
    'mentor_bid:create', 'mentor_bid:read:own',
    'marketplace:read', 'leaderboard:read', 'profile:read', 'profile:update:own',
  ],
  [ROLES.SUPERADMIN]: ['*'],
};

module.exports = PERMISSION_MAP;
