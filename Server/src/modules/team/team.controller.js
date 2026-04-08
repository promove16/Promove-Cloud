const teamService = require('./team.service');

async function createTeam(req, res) {
  const team = await teamService.createTeam(req.user._id, req.body);
  res.status(201).json({ success: true, team });
}

async function getTeam(req, res) {
  const team = await teamService.getTeam(req.params.id, req.user._id);
  res.json({ success: true, team });
}

async function inviteByEmail(req, res) {
  const result = await teamService.inviteByEmail(
    req.params.id,
    req.user._id,
    req.body.email,
    req.body.role
  );

  res.json({ success: true, message: result.message });
}

async function acceptInvitation(req, res) {
  const result = await teamService.acceptInvitation(req.params.token);
  res.json({ success: true, ...result });
}

async function declineInvitation(req, res) {
  const result = await teamService.declineInvitation(req.params.token);
  res.json({ success: true, message: result.message });
}

async function updateMemberRole(req, res) {
  const team = await teamService.updateMemberRole(
    req.params.id,
    req.user._id,
    req.params.uid,
    req.body.role
  );

  res.json({ success: true, team });
}

async function removeMember(req, res) {
  const team = await teamService.removeMember(req.params.id, req.user._id, req.params.uid);
  res.json({ success: true, team });
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
