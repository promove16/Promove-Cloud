const Project = require('../../models/Project');
const Board = require('../../models/Board');
const Team = require('../../models/Team');
const Ticket = require('../../models/Ticket');
const Sprint = require('../../models/Sprint');
const StudentProfile = require('../../models/StudentProfile');
const MentorProfile = require('../../models/MentorProfile');
const ApiError = require('../../utils/ApiError');
const paginate = require('../../utils/pagination');
const slugify = require('../../utils/slugify');
const { assertProjectLead, canAccessProject, isTeamMember } = require('../../utils/projectAccess');
const { deleteFile } = require('../upload/upload.service');

function normalizeArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function createProject(userId, body) {
  const project = await Project.create({
    title: body.title,
    slug: slugify(body.title),
    description: body.description || '',
    tags: normalizeArray(body.tags),
    techStack: normalizeArray(body.techStack),
    leadStudentId: userId,
    status: 'planning',
    isPublic: false,
  });

  const board = await Board.create({
    projectId: project._id,
    name: `${project.title} Board`,
  });

  project.jiraBoard = board._id;
  await project.save();

  await StudentProfile.findOneAndUpdate(
    { userId },
    { $addToSet: { projectIds: project._id } },
    { new: true }
  );

  return Project.findById(project._id).populate('jiraBoard');
}

async function getMyProjects(userId, queryOptions) {
  const teams = await Team.find({ 'members.userId': userId }).select('_id');
  const teamIds = teams.map((team) => team._id);

  const query = Project.find({
    $or: [
      { leadStudentId: userId },
      { teamId: { $in: teamIds } },
    ],
  })
    .populate({ path: 'teamId', select: 'name members' })
    .populate({ path: 'mentorId', select: 'name profilePicture' })
    .populate({ path: 'jiraBoard', select: '_id name' });

  return paginate(query, queryOptions);
}

async function getProjects(queryOptions) {
  const filters = { isPublic: true };

  if (queryOptions.status) {
    filters.status = queryOptions.status;
  }

  const tags = normalizeArray(queryOptions.tags);
  if (tags.length > 0) {
    filters.tags = { $in: tags };
  }

  if (queryOptions.search) {
    filters.title = { $regex: queryOptions.search, $options: 'i' };
  }

  const query = Project.find(filters)
    .populate({ path: 'leadStudentId', select: 'name profilePicture' })
    .populate({ path: 'teamId', select: 'name members' });

  return paginate(query, queryOptions);
}

async function getMarketplaceListings(queryOptions) {
  const filters = { 'marketplaceListing.status': 'listed' };
  const tags = normalizeArray(queryOptions.tags);

  if (tags.length > 0) {
    filters.tags = { $in: tags };
  }

  if (queryOptions.minPrice || queryOptions.maxPrice) {
    filters['marketplaceListing.price'] = {};

    if (queryOptions.minPrice) {
      filters['marketplaceListing.price'].$gte = Number(queryOptions.minPrice);
    }

    if (queryOptions.maxPrice) {
      filters['marketplaceListing.price'].$lte = Number(queryOptions.maxPrice);
    }
  }

  const query = Project.find(filters)
    .populate({ path: 'leadStudentId', select: 'name profilePicture' });

  return paginate(query, {
    ...queryOptions,
    sort: queryOptions.sort || '-createdAt',
  });
}

async function getProject(projectId, userId) {
  const project = await Project.findById(projectId)
    .populate({
      path: 'teamId',
      populate: { path: 'members.userId', select: 'name email profilePicture' },
    })
    .populate({ path: 'mentorId', select: 'name profilePicture' })
    .populate('jiraBoard');

  if (!project) {
    throw ApiError.notFound('Project');
  }

  if (!project.isPublic) {
    const allowed = await canAccessProject(project, userId);

    if (!allowed) {
      throw ApiError.forbidden('You do not have access to this project');
    }
  }

  project.viewCount += 1;
  await project.save();

  if (project.mentorId) {
    const mentorProfile = await MentorProfile.findOne({ userId: project.mentorId._id }).select('expertise');

    if (mentorProfile) {
      project.mentorId = {
        ...project.mentorId.toObject(),
        expertise: mentorProfile.expertise,
      };
    }
  }

  return project;
}

async function getProjectForEdit(projectId, userId) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw ApiError.notFound('Project');
  }

  await assertProjectLead(project, userId);
  return project;
}

async function updateProject(projectId, userId, updates) {
  const project = await getProjectForEdit(projectId, userId);
  const allowedFields = ['title', 'description', 'tags', 'techStack', 'status'];

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      project[field] = field === 'tags' || field === 'techStack'
        ? normalizeArray(updates[field])
        : updates[field];
    }
  });

  if (updates.title) {
    project.slug = slugify(updates.title);
  }

  await project.save();
  return project;
}

async function deleteProject(projectId, userId) {
  const project = await getProjectForEdit(projectId, userId);

  if (project.status !== 'planning') {
    throw ApiError.badRequest('Only planning projects can be deleted');
  }

  const board = await Board.findOne({ projectId: project._id });

  if (board) {
    await Ticket.deleteMany({ boardId: board._id });
    await Sprint.deleteMany({ boardId: board._id });
    await Board.deleteOne({ _id: board._id });
  }

  await StudentProfile.findOneAndUpdate(
    { userId },
    { $pull: { projectIds: project._id } }
  );

  if (project.teamId) {
    await Team.findByIdAndUpdate(project.teamId, { projectId: null });
  }

  await Project.deleteOne({ _id: project._id });

  return { message: 'Project deleted' };
}

async function addFiles(projectId, userId, files) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw ApiError.notFound('Project');
  }

  const memberAccess = await canAccessProject(project, userId);
  if (!memberAccess) {
    throw ApiError.forbidden('You do not have access to this project');
  }

  const urls = files.map((file) => file.url);
  project.files.push(...urls);
  await project.save();

  return project;
}

async function removeFileFromProject(projectId, userId, publicId) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw ApiError.notFound('Project');
  }

  const memberAccess = await canAccessProject(project, userId);
  if (!memberAccess) {
    throw ApiError.forbidden('You do not have access to this project');
  }

  project.files = project.files.filter((fileUrl) => !fileUrl.includes(publicId));
  await project.save();
  await deleteFile(publicId);

  return project;
}

async function updateMarketplaceListing(projectId, userId, body) {
  const project = await getProjectForEdit(projectId, userId);

  if (project.status !== 'completed') {
    throw ApiError.badRequest('Only completed projects can be listed');
  }

  project.marketplaceListing = {
    ...project.marketplaceListing,
    price: body.price ?? project.marketplaceListing.price,
    description: body.description ?? project.marketplaceListing.description,
    status: body.status ?? project.marketplaceListing.status,
  };

  await project.save();
  return project;
}

async function toggleVisibility(projectId, userId, body) {
  const project = await getProjectForEdit(projectId, userId);
  project.isPublic = Boolean(body.isPublic);
  await project.save();
  return project;
}

async function getProjectByBoardAccess(boardId, userId) {
  const project = await Project.findOne({ jiraBoard: boardId });

  if (!project) {
    throw ApiError.notFound('Project');
  }

  const allowed = await canAccessProject(project, userId);
  if (!allowed) {
    throw ApiError.forbidden('You do not have access to this project');
  }

  return project;
}

module.exports = {
  createProject,
  getMyProjects,
  getProjects,
  getMarketplaceListings,
  getProject,
  updateProject,
  deleteProject,
  addFiles,
  removeFileFromProject,
  updateMarketplaceListing,
  toggleVisibility,
  getProjectByBoardAccess,
};
