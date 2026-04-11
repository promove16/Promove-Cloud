import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import {
  AdminListSupportTicketsFilters,
  CreateSupportTicketPayload,
  ListSupportTicketsFilters,
  SupportAnalyticsSummary,
  SupportAttachmentInput,
  SupportAttachmentUpload,
  SupportPriority,
  SupportStatus,
  SupportTicket,
} from '../types/support.types';

const BASE = '/api/support';

const stripUndefined = (input: Record<string, unknown>): Record<string, unknown> => {
  const output: Record<string, unknown> = {};

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      output[key] = value;
    }
  });

  return output;
};

export const supportApi = {
  async listMyTickets(filters: ListSupportTicketsFilters = {}) {
    const response = await api.get<ApiSuccessResponse<SupportTicket[]>>(`${BASE}/tickets`, {
      params: stripUndefined(filters as Record<string, unknown>),
    });
    return response.data.data;
  },
  async createTicket(payload: CreateSupportTicketPayload) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(`${BASE}/tickets`, payload);
    return response.data.data;
  },
  async getTicket(ticketId: string) {
    const response = await api.get<ApiSuccessResponse<SupportTicket>>(`${BASE}/tickets/${ticketId}`);
    return response.data.data;
  },
  async addReply(ticketId: string, body: string, attachments?: SupportAttachmentInput[]) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/tickets/${ticketId}/reply`,
      { body, ...(attachments?.length ? { attachments } : {}) },
    );
    return response.data.data;
  },
  async reopenTicket(ticketId: string, note?: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/tickets/${ticketId}/reopen`,
      { note },
    );
    return response.data.data;
  },
  async submitFeedback(ticketId: string, rating: number, comment?: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/tickets/${ticketId}/feedback`,
      { rating, comment },
    );
    return response.data.data;
  },
  async adminList(filters: AdminListSupportTicketsFilters = {}) {
    const response = await api.get<ApiSuccessResponse<SupportTicket[]>>(`${BASE}/admin/tickets`, {
      params: stripUndefined(filters as Record<string, unknown>),
    });
    return response.data.data;
  },
  async adminAnalytics() {
    const response = await api.get<ApiSuccessResponse<SupportAnalyticsSummary>>(
      `${BASE}/admin/analytics`,
    );
    return response.data.data;
  },
  async adminGetTicket(ticketId: string) {
    const response = await api.get<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}`,
    );
    return response.data.data;
  },
  async adminAssign(ticketId: string, assignedTo: string | null) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/assign`,
      { assignedTo },
    );
    return response.data.data;
  },
  async adminChangeStatus(ticketId: string, status: SupportStatus, note?: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/status`,
      { status, note },
    );
    return response.data.data;
  },
  async adminChangePriority(ticketId: string, priority: SupportPriority, note?: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/priority`,
      { priority, note },
    );
    return response.data.data;
  },
  async adminInternalNote(ticketId: string, body: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/internal-note`,
      { body },
    );
    return response.data.data;
  },
  async adminReply(ticketId: string, body: string, attachments?: SupportAttachmentInput[]) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/reply`,
      { body, ...(attachments?.length ? { attachments } : {}) },
    );
    return response.data.data;
  },
  async adminEscalate(ticketId: string, note: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/escalate`,
      { note },
    );
    return response.data.data;
  },
  async adminApproveStartupEditUnlock(ticketId: string, note?: string) {
    const response = await api.post<ApiSuccessResponse<SupportTicket>>(
      `${BASE}/admin/tickets/${ticketId}/startup-edit-unlock`,
      note ? { note } : {},
    );
    return response.data.data;
  },
  async uploadAttachment(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiSuccessResponse<SupportAttachmentUpload>>(
      `${BASE}/upload`,
      formData,
    );
    return response.data.data;
  },
};
