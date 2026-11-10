import { apiClient } from './client';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'BILLING' | 'TECHNICAL' | 'FEATURE_REQUEST' | 'DATA_ISSUE' | 'ACCESS' | 'OTHER';

export interface SupportTicket {
  id: string;
  ticketNo: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdById: string | null;
  createdBy: { firstName: string; lastName: string; email: string } | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  isStaff: boolean;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface TicketStats {
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
}

export const supportApi = {
  getStats: () => apiClient.get<TicketStats>('/support/stats').then(r => r.data),
  listTickets: (page = 1, limit = 20, status?: string) =>
    apiClient.get<{ data: SupportTicket[]; meta: { total: number; totalPages: number } }>(
      '/support/tickets', { params: { page, limit, status } }
    ).then(r => r.data),
  getTicket: (id: string) => apiClient.get<SupportTicket>(`/support/tickets/${id}`).then(r => r.data),
  createTicket: (data: { subject: string; category: string; priority?: string; message: string }) =>
    apiClient.post<SupportTicket>('/support/tickets', data).then(r => r.data),
  addMessage: (id: string, content: string) =>
    apiClient.post<TicketMessage>(`/support/tickets/${id}/messages`, { content }).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    apiClient.patch<SupportTicket>(`/support/tickets/${id}/status`, { status }).then(r => r.data),
};
