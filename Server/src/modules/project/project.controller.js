const projectService = require('./project.service');

async function createProject(req, res) {
  const project = await projectService.createProject(req.user._id, req.body);
  res.status(201).json({ success: true, project });
}

async function getMyProjects(req, res) {
  const result = await projectService.getMyProjects(req.user._id, req.query);
  res.json({ success: true, ...result });
}

async function getProjects(req, res) {
  const result = await projectService.getProjects(req.query);
  res.json({ success: true, ...result });
}

async function getMarketplaceListings(req, res) {
  const result = await projectService.getMarketplaceListings(req.query);
  res.json({ success: true, ...result });
}

async function getProject(req, res) {
  const project = await projectService.getProject(req.params.id, req.user._id);
  res.json({ success: true, project });
}

async function updateProject(req, res) {
  const project = await projectService.updateProject(req.params.id, req.user._id, req.body);
  res.json({ success: true, project });
}

async function deleteProject(req, res) {
  const result = await projectService.deleteProject(req.params.id, req.user._id);
  res.json({ success: true, message: result.message });
}

async function addFiles(req, res) {
  const project = await projectService.addFiles(req.params.id, req.user._id, req.body.files || []);
  res.json({ success: true, project });
}

async function removeFile(req, res) {
  const project = await projectService.removeFileFromProject(
    req.params.id,
    req.user._id,
    decodeURIComponent(req.params.publicId)
  );

  res.json({ success: true, project });
}

async function updateMarketplaceListing(req, res) {
  const project = await projectService.updateMarketplaceListing(req.params.id, req.user._id, req.body);
  res.json({ success: true, project });
}

async function toggleVisibility(req, res) {
  const project = await projectService.toggleVisibility(req.params.id, req.user._id, req.body);
  res.json({ success: true, project });
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
  removeFile,
  updateMarketplaceListing,
  toggleVisibility,
};
