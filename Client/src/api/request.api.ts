import api from './axiosInstance';
import { ApiSuccessResponse } from '../types/auth.types';
import { RequestActionType, RequestType, WorkflowRequest } from '../types/request.types';

const WORKFLOW_REQUESTS_BASE = '/api/workflow-requests';

export interface CreateWorkflowRequestPayload {
  requestType: RequestType;
  actionType?: RequestActionType;
  toUserId?: string;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityTitle?: string;
  targetRole?: string;
  requestedRole?: string;
  requestedPermission?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt?: string;
}

export const requestApi = {
  async incoming() {
    const response = await api.get<ApiSuccessResponse<WorkflowRequest[]>>(`${WORKFLOW_REQUESTS_BASE}/incoming`);
    return response.data.data;
  },
  async outgoing() {
    const response = await api.get<ApiSuccessResponse<WorkflowRequest[]>>(`${WORKFLOW_REQUESTS_BASE}/outgoing`);
    return response.data.data;
  },
  async create(payload: CreateWorkflowRequestPayload) {
    const response = await api.post<ApiSuccessResponse<WorkflowRequest>>(WORKFLOW_REQUESTS_BASE, payload);
    return response.data.data;
  },
  async get(requestId: string) {
    const response = await api.get<ApiSuccessResponse<WorkflowRequest>>(`${WORKFLOW_REQUESTS_BASE}/${requestId}`);
    return response.data.data;
  },
  async accept(requestId: string) {
    const response = await api.post<ApiSuccessResponse<WorkflowRequest>>(`${WORKFLOW_REQUESTS_BASE}/${requestId}/accept`);
    return response.data.data;
  },
  async decline(requestId: string) {
    const response = await api.post<ApiSuccessResponse<WorkflowRequest>>(`${WORKFLOW_REQUESTS_BASE}/${requestId}/decline`);
    return response.data.data;
  },
  async withdraw(requestId: string) {
    const response = await api.post<ApiSuccessResponse<WorkflowRequest>>(`${WORKFLOW_REQUESTS_BASE}/${requestId}/withdraw`);
    return response.data.data;
  },
};
