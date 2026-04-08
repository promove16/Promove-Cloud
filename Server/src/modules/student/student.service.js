const User = require('../../models/User');
const StudentProfile = require('../../models/StudentProfile');
const Project = require('../../models/Project');
const Ticket = require('../../models/Ticket');
const Board = require('../../models/Board');
const { ApiError } = require('../../utils/ApiError');

async function getDashboardStats(userId) {
  const [activeProjects, totalProjects, openTickets, profile, recentProjects] = await Promise.all([
    Project.countDocuments({ leadStudentId: userId, status: 'active' }),
    Project.countDocuments({ leadStudentId: userId }),
    Ticket.countDocuments({ assigneeId: userId, status: { $ne: 'done' } }),
    StudentProfile.findOne({ userId }).select('teamId leaderboardScore'),
    Project.find({ leadStudentId: userId }).sort({ createdAt: -1 }).limit(3).select('title status tags jiraBoard'),
  ]);

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const upcomingTickets = await Ticket.find({
    assigneeId: userId,
    dueDate: { $gte: start, $lte: end },
    status: { $ne: 'done' },
  })
    .sort({ dueDate: 1 })
    .select('title dueDate priority boardId');

  const boards = await Board.find({ _id: { $in: upcomingTickets.map((ticket) => ticket.boardId) } }).select('projectId');
  const boardProjectMap = boards.reduce((accumulator, board) => {
    accumulator[String(board._id)] = String(board.projectId);
    return accumulator;
  }, {});
  const projects = await Project.find({ _id: { $in: Object.values(boardProjectMap) } }).select('title');
  const projectTitleMap = projects.reduce((accumulator, project) => {
    accumulator[String(project._id)] = project.title;
    return accumulator;
  }, {});

  return {
    activeProjects,
    totalProjects,
    openTickets,
    teamId: profile?.teamId || null,
    leaderboardScore: profile?.leaderboardScore || 0,
    recentProjects,
    upcomingDeadlines: upcomingTickets.map((ticket) => ({
      ...ticket.toObject(),
      projectTitle: projectTitleMap[boardProjectMap[String(ticket.boardId)]] || 'Unknown Project',
    })),
  };
}

async function buildPortfolio(targetUserId, publicOnly) {
  const [user, profile] = await Promise.all([
    User.findById(targetUserId).select('name email profilePicture role isVerified'),
    StudentProfile.findOne({ userId: targetUserId }),
  ]);

  if (!user || !profile) {
    throw ApiError.notFound('Student');
  }

  if (publicOnly && !user.isVerified) {
    throw ApiError.notFound('Portfolio');
  }

  const projectQuery = publicOnly
    ? { leadStudentId: targetUserId, isPublic: true }
    : { leadStudentId: targetUserId };

  const projects = await Project.find(projectQuery).select('title description tags techStack status viewCount files isPublic jiraBoard');

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      role: user.role,
    },
    profile: {
      bio: profile.bio,
      skills: profile.skills,
      githubUrl: profile.githubUrl,
      linkedinUrl: profile.linkedinUrl,
    },
    projects,
    achievements: {
      leaderboardScore: profile.leaderboardScore,
      hackathonCount: profile.hackathonIds.length,
      courseCount: profile.edtechCourses.length,
    },
  };
}

async function getPortfolio(userId) {
  return buildPortfolio(userId, false);
}

async function getPublicPortfolio(userId) {
  return buildPortfolio(userId, true);
}

module.exports = {
  getDashboardStats,
  getPortfolio,
  getPublicPortfolio,
};
