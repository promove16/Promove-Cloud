const crypto = require('crypto');
const Team = require('../../models/Team');
const User = require('../../models/User');
const Project = require('../../models/Project');
const StudentProfile = require('../../models/StudentProfile');
const { ApiError } = require('../../utils/ApiError');
const emailService = require('../../utils/emailService');

async function createTeam(userId, body) {
  const team = await Team.create({
    name: body.name,
    projectId: body.projectId || null,
    leadId: userId,
    members: [{
      userId,
      role: 'lead',
      joinedAt: new Date(),
    }],
  });

  if (body.projectId) {
    const project = await Project.findById(body.projectId);

    if (!project) {
      throw ApiError.notFound('Project');
    }

    if (String(project.leadStudentId) !== String(userId)) {
      throw ApiError.forbidden('Only the project lead can attach a team');
    }

    team.projectId = project._id;
    await team.save();

    project.teamId = team._id;
    await project.save();
  }

  await StudentProfile.findOneAndUpdate(
    { userId },
    { teamId: team._id },
    { new: true }
  );

  return team;
}

async function getTeam(teamId, userId) {
  const team = await Team.findById(teamId)
    .populate({ path: 'members.userId', select: 'name email profilePicture role' });

  if (!team) {
    throw ApiError.notFound('Team');
  }

  const isMember = team.members.some((member) => String(member.userId._id || member.userId) === String(userId));

  if (!isMember) {
    throw ApiError.forbidden('You do not have access to this team');
  }

  return team;
}

async function inviteByEmail(teamId, userId, email, role) {
  const team = await Team.findById(teamId);

  if (!team) {
    throw ApiError.notFound('Team');
  }

  if (String(team.leadId) !== String(userId)) {
    throw ApiError.forbidden('Only the team lead can invite members');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser && team.members.some((member) => String(member.userId) === String(existingUser._id))) {
    throw ApiError.badRequest('User is already a member');
  }

  const existingInvite = team.invitations.find((invite) => invite.email === email && invite.status === 'pending');
  if (existingInvite) {
    throw ApiError.badRequest('An invitation is already pending for this email');
  }

  const token = crypto.randomBytes(24).toString('hex');
  team.invitations.push({
    email,
    role,
    token,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: 'pending',
  });
  await team.save();

  const inviter = await User.findById(userId).select('name');
  await emailService.sendTeamInvitationEmail(email, inviter?.name || 'A teammate', token);

  return { message: 'Invitation sent' };
}

async function acceptInvitation(token) {
  const team = await Team.findOne({ 'invitations.token': token });

  if (!team) {
    throw ApiError.badRequest('Invitation is invalid');
  }

  const invitation = team.invitations.find((item) => item.token === token);

  if (invitation.status !== 'pending') {
    throw ApiError.badRequest('Invitation already used');
  }

  if (invitation.expiresAt < new Date()) {
    throw ApiError.badRequest('Invitation expired');
  }

  const user = await User.findOne({ email: invitation.email });

  if (!user) {
    return { requiresRegistration: true, email: invitation.email };
  }

  if (!team.members.some((member) => String(member.userId) === String(user._id))) {
    team.members.push({
      userId: user._id,
      role: invitation.role || 'developer',
      joinedAt: new Date(),
    });
  }

  invitation.status = 'accepted';
  await team.save();

  await StudentProfile.findOneAndUpdate({ userId: user._id }, { teamId: team._id });

  return { message: 'You have joined the team', teamId: team._id };
}

async function declineInvitation(token) {
  const team = await Team.findOne({ 'invitations.token': token });

  if (!team) {
    throw ApiError.badRequest('Invitation is invalid');
  }

  const invitation = team.invitations.find((item) => item.token === token);
  invitation.status = 'declined';
  await team.save();

  return { message: 'Invitation declined' };
}

async function updateMemberRole(teamId, leadId, targetUserId, newRole) {
  const team = await Team.findById(teamId);

  if (!team) {
    throw ApiError.notFound('Team');
  }

  if (String(team.leadId) !== String(leadId)) {
    throw ApiError.forbidden('Only the team lead can update roles');
  }

  if (String(team.leadId) === String(targetUserId)) {
    throw ApiError.badRequest('Cannot change the lead role');
  }

  const member = team.members.find((item) => String(item.userId) === String(targetUserId));

  if (!member) {
    throw ApiError.notFound('Member');
  }

  member.role = newRole;
  await team.save();

  return team;
}

async function removeMember(teamId, leadId, targetUserId) {
  const team = await Team.findById(teamId);

  if (!team) {
    throw ApiError.notFound('Team');
  }

  if (String(team.leadId) !== String(leadId)) {
    throw ApiError.forbidden('Only the team lead can remove members');
  }

  if (String(team.leadId) === String(targetUserId)) {
    throw ApiError.badRequest('Cannot remove the team lead');
  }

  team.members = team.members.filter((item) => String(item.userId) !== String(targetUserId));
  await team.save();

  await StudentProfile.findOneAndUpdate({ userId: targetUserId }, { teamId: null });

  return team;
}

module.exports = {
  createTeam,
  getTeam,
  inviteByEmail,
  acceptInvitation,
  declineInvitation,
  updateMemberRole,
  removeMember,
};
