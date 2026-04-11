import { Request, Response } from 'express';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  addInternalNoteSchema,
  addReplySchema,
  adminListTicketsQuerySchema,
  assignTicketSchema,
  changePrioritySchema,
  changeStatusSchema,
  createTicketSchema,
  escalateSchema,
  feedbackSchema,
  listTicketsQuerySchema,
  startupEditUnlockSchema,
} from './support.validation';
import {
  addUserReply,
  adminAddInternalNote,
  adminAddReply,
  adminAnalytics,
  adminAssignTicket,
  adminChangePriority,
  adminChangeStatus,
  adminEscalateTicket,
  adminApproveStartupEditUnlock,
  adminListTickets,
  createTicket,
  getTicketForViewer,
  listUserTickets,
  reopenTicket,
  submitFeedback,
} from './support.service';

const requireUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  return req.user;
};

const getTicketId = (req: Request) => {
  const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!ticketId) {
    throw new ApiError(400, 'SUPPORT_TICKET_ID_REQUIRED', 'Ticket id is required.');
  }
  return ticketId;
};

export const createTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = createTicketSchema.parse(req.body ?? {});
  const ticket = await createTicket({
    userId: user._id,
    userRole: user.role,
    institutionId: user.institutionId,
    payload,
  });
  res.status(201).json(new ApiResponse(ticket));
};

export const listMyTicketsController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const filters = listTicketsQuerySchema.parse(req.query ?? {});
  const tickets = await listUserTickets(user._id, user.role, filters);
  res.json(new ApiResponse(tickets));
};

export const getTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const ticket = await getTicketForViewer(getTicketId(req), { userId: user._id, role: user.role });
  res.json(new ApiResponse(ticket));
};

export const addUserReplyController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = addReplySchema.parse(req.body ?? {});
  const ticket = await addUserReply({
    ticketId: getTicketId(req),
    userId: user._id,
    userRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const reopenTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const note = typeof req.body?.note === 'string' ? String(req.body.note).slice(0, 500) : undefined;
  const ticket = await reopenTicket({
    ticketId: getTicketId(req),
    userId: user._id,
    userRole: user.role,
    note,
  });
  res.json(new ApiResponse(ticket));
};

export const submitFeedbackController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = feedbackSchema.parse(req.body ?? {});
  const ticket = await submitFeedback({
    ticketId: getTicketId(req),
    userId: user._id,
    userRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminListTicketsController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const filters = adminListTicketsQuerySchema.parse(req.query ?? {});
  const tickets = await adminListTickets(user._id, user.role, filters);
  res.json(new ApiResponse(tickets));
};

export const adminGetTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const ticket = await getTicketForViewer(getTicketId(req), { userId: user._id, role: user.role });
  res.json(new ApiResponse(ticket));
};

export const adminAssignTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = assignTicketSchema.parse(req.body ?? {});
  const ticket = await adminAssignTicket({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminChangeStatusController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = changeStatusSchema.parse(req.body ?? {});
  const ticket = await adminChangeStatus({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminChangePriorityController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = changePrioritySchema.parse(req.body ?? {});
  const ticket = await adminChangePriority({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminAddInternalNoteController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = addInternalNoteSchema.parse(req.body ?? {});
  const ticket = await adminAddInternalNote({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminAddReplyController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = addReplySchema.parse(req.body ?? {});
  const ticket = await adminAddReply({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminEscalateTicketController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = escalateSchema.parse(req.body ?? {});
  const ticket = await adminEscalateTicket({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminApproveStartupEditUnlockController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = startupEditUnlockSchema.parse(req.body ?? {});
  const ticket = await adminApproveStartupEditUnlock({
    ticketId: getTicketId(req),
    actorUserId: user._id,
    actorRole: user.role,
    payload,
  });
  res.json(new ApiResponse(ticket));
};

export const adminAnalyticsController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const summary = await adminAnalytics(user.role);
  res.json(new ApiResponse(summary));
};

export const uploadSupportAttachmentController = async (req: Request, res: Response) => {
  const user = requireUser(req);

  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A file is required.');
  }

  const isPdf = req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname);
  const upload = await uploadToCloudinary(
    req.file.buffer,
    `support/${user._id}`,
    isPdf ? 'raw' : 'image',
    isPdf ? { format: 'pdf' } : undefined,
  );

  res.json(
    new ApiResponse({
      url: upload.secure_url,
      publicId: upload.public_id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || undefined,
    }),
  );
};
