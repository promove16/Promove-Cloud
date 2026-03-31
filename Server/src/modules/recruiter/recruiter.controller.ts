import { Request, Response } from 'express';
import { UserRole } from '../../types/roles.types';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  applyToRecruiterJob,
  closeRecruiterDrive,
  createRecruiterDrive,
  createRecruiterJob,
  deleteRecruiterJob,
  driveCreateSchema,
  driveIdSchema,
  driveScoreSchema,
  getPublicRecruiterJobs,
  getRecruiterColleges,
  getRecruiterDashboard,
  getRecruiterDrives,
  getRecruiterJobs,
  getRecruiterMessageCheck,
  getRecruiterOnboarding,
  getRecruiterTalentDiscover,
  getRecruiterTalentPipeline,
  getRecruiterTalentProfile,
  hireSchema,
  jobCreateSchema,
  jobIdSchema,
  jobUpdateSchema,
  markStudentHired,
  messageSchema,
  publicJobsQuerySchema,
  registerForDrive,
  removeShortlist,
  sendRecruiterMessage,
  shortlistStudent,
  studentIdSchema,
  submitDriveScore,
  talentQuerySchema,
  updateRecruiterJob,
} from './recruiter.service';

export const getDashboardController = async (req: Request, res: Response) => {
  const data = await getRecruiterDashboard(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getTalentPipelineController = async (req: Request, res: Response) => {
  const query = talentQuerySchema.parse(req.query);
  const data = await getRecruiterTalentPipeline(req.user!._id, query);
  res.status(200).json(new ApiResponse(data));
};

export const getTalentDiscoverController = async (req: Request, res: Response) => {
  const query = talentQuerySchema.parse(req.query);
  const data = await getRecruiterTalentDiscover(req.user!._id, query);
  res.status(200).json(new ApiResponse(data));
};

export const getTalentProfileController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const data = await getRecruiterTalentProfile(req.user!._id, studentId);
  res.status(200).json(new ApiResponse(data));
};

export const shortlistStudentController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const data = await shortlistStudent(req.user!._id, studentId);
  res.status(200).json(new ApiResponse(data));
};

export const removeShortlistController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const data = await removeShortlist(req.user!._id, studentId);
  res.status(200).json(new ApiResponse(data));
};

export const getJobsController = async (req: Request, res: Response) => {
  const data = await getRecruiterJobs(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const getPublicJobsController = async (req: Request, res: Response) => {
  const { recruiterId } = publicJobsQuerySchema.parse(req.params);
  const studentId = req.user?.role === UserRole.STUDENT ? req.user._id : undefined;
  const data = await getPublicRecruiterJobs(recruiterId, studentId);
  res.status(200).json(new ApiResponse(data));
};

export const createJobController = async (req: Request, res: Response) => {
  const payload = jobCreateSchema.parse(req.body);
  const data = await createRecruiterJob(req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const updateJobController = async (req: Request, res: Response) => {
  const { jobId } = jobIdSchema.parse(req.params);
  const payload = jobUpdateSchema.parse(req.body);
  const data = await updateRecruiterJob(req.user!._id, jobId, payload);
  res.status(200).json(new ApiResponse(data));
};

export const deleteJobController = async (req: Request, res: Response) => {
  const { jobId } = jobIdSchema.parse(req.params);
  const data = await deleteRecruiterJob(req.user!._id, jobId);
  res.status(200).json(new ApiResponse(data));
};

export const applyJobController = async (req: Request, res: Response) => {
  const { jobId } = jobIdSchema.parse(req.params);
  const data = await applyToRecruiterJob(req.user!._id, jobId);
  res.status(200).json(new ApiResponse(data));
};

export const getDrivesController = async (req: Request, res: Response) => {
  const data = await getRecruiterDrives(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const createDriveController = async (req: Request, res: Response) => {
  const payload = driveCreateSchema.parse(req.body);
  const data = await createRecruiterDrive(req.user!._id, payload);
  res.status(201).json(new ApiResponse(data));
};

export const registerForDriveController = async (req: Request, res: Response) => {
  const { driveId } = driveIdSchema.parse(req.params);
  const data = await registerForDrive(req.user!._id, driveId);
  res.status(200).json(new ApiResponse(data));
};

export const submitDriveScoreController = async (req: Request, res: Response) => {
  const { driveId } = driveIdSchema.parse(req.params);
  const payload = driveScoreSchema.parse(req.body);
  const data = await submitDriveScore(req.user!._id, driveId, payload.studentId, payload.submissionScore);
  res.status(200).json(new ApiResponse(data));
};

export const closeDriveController = async (req: Request, res: Response) => {
  const { driveId } = driveIdSchema.parse(req.params);
  const data = await closeRecruiterDrive(req.user!._id, driveId);
  res.status(200).json(new ApiResponse(data));
};

export const getCollegesController = async (_req: Request, res: Response) => {
  const data = await getRecruiterColleges();
  res.status(200).json(new ApiResponse(data));
};

export const getOnboardingController = async (req: Request, res: Response) => {
  const data = await getRecruiterOnboarding(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const hiredStudentController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const payload = hireSchema.parse(req.body);
  const data = await markStudentHired(req.user!._id, studentId, payload.companyName);
  res.status(200).json(new ApiResponse(data));
};

export const messageCheckController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const data = await getRecruiterMessageCheck(req.user!._id, studentId);
  res.status(200).json(new ApiResponse(data));
};

export const sendMessageController = async (req: Request, res: Response) => {
  const { studentId } = studentIdSchema.parse(req.params);
  const payload = messageSchema.parse(req.body);
  const data = await sendRecruiterMessage(req.user!._id, studentId, payload.body);
  res.status(200).json(new ApiResponse(data));
};
