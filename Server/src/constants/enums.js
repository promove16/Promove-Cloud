module.exports = Object.freeze({
  PROJECT_STATUS: ['planning', 'active', 'paused', 'completed', 'sold'],
  TICKET_STATUS: ['backlog', 'todo', 'in_progress', 'review', 'done'],
  TICKET_PRIORITY: ['P0', 'P1', 'P2', 'P3'],
  PITCH_STATUS: ['pending', 'under_review', 'accepted', 'declined'],
  PAYMENT_STATUS: ['held', 'released', 'disputed', 'refunded'],
  SPRINT_STATUS: ['planned', 'active', 'completed'],
  TEAM_MEMBER_ROLE: ['lead', 'developer', 'designer', 'tester'],
  EVENT_TYPE: [
    'workshop',
    'bootcamp',
    'alumni_meet',
    'campus_drive',
    'hiring_fair',
    'hackathon'
  ],
  INVITE_STATUS: ['pending', 'accepted', 'declined'],
  HIRING_MODE: ['campus', 'direct', 'both'],
  MARKETPLACE_STATUS: ['not_listed', 'listed', 'sold'],
});
