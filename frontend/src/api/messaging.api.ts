import { apiClient } from './client';

export interface MessagingSettings {
  tenantId: string;
  apiKey: string | null;
  username: string | null;
  senderId: string | null;
  whatsappNumber: string | null;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
}

export interface SmsCampaign {
  id: string;
  name: string;
  message: string;
  channel: 'SMS' | 'WHATSAPP';
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
  messages?: SmsMessage[];
}

export interface SmsMessage {
  id: string;
  recipient: string;
  message: string;
  channel: 'SMS' | 'WHATSAPP';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  providerRef: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  campaignId: string | null;
}

export type MsgChannel = 'SMS' | 'WHATSAPP';

export interface MessageThread {
  id: string;
  customerPhone: string;
  customerName: string | null;
  channel: MsgChannel;
  lastMessageAt: string;
  unreadCount: number;
  messages?: ThreadMessage[];
  createdAt: string;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  language: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string | null;
  filters: SegmentFilters;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentFilters {
  hasOverdueBalance?: boolean;
  minOutstandingBalance?: number;
  lastPurchaseDays?: number;
  noPurchaseDays?: number;
  minTotalOrders?: number;
  creditOnly?: boolean;
  isActive?: boolean;
}

export interface SegmentCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditAllowed: boolean;
  isActive: boolean;
  outstandingBalance?: number;
  _count: { invoices: number };
}

export interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    channel: string;
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    sentAt: string | null;
  };
  delivery: {
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
  };
  revenue: {
    attributedRevenue: number;
    attributedInvoices: number;
    attributionWindow: string;
  };
}

export const messagingApi = {
  getSettings: () =>
    apiClient.get<MessagingSettings>('/messaging/settings').then((r) => r.data),

  updateSettings: (data: Partial<MessagingSettings>) =>
    apiClient.put<MessagingSettings>('/messaging/settings', data).then((r) => r.data),

  listCampaigns: (page = 1, limit = 20) =>
    apiClient
      .get<{ data: SmsCampaign[]; meta: { total: number; totalPages: number } }>('/messaging/campaigns', { params: { page, limit } })
      .then((r) => r.data),

  getCampaign: (id: string) =>
    apiClient.get<SmsCampaign>(`/messaging/campaigns/${id}`).then((r) => r.data),

  createCampaign: (data: { name: string; message: string; channel: MsgChannel; recipients?: string[]; segmentId?: string }) =>
    apiClient.post<SmsCampaign>('/messaging/campaigns', data).then((r) => r.data),

  getCampaignAnalytics: (id: string) =>
    apiClient.get<CampaignAnalytics>(`/messaging/campaigns/${id}/analytics`).then((r) => r.data),

  sendCampaign: (id: string) =>
    apiClient.post<SmsCampaign>(`/messaging/campaigns/${id}/send`).then((r) => r.data),

  sendQuick: (data: { recipient: string; message: string; channel: MsgChannel }) =>
    apiClient.post<SmsMessage>('/messaging/send', data).then((r) => r.data),

  sendReminders: (data: { customerIds: string[]; customMessage?: string; channel: MsgChannel }) =>
    apiClient.post<{ results: Array<{ customerId: string; name: string; phone: string; status: string }> }>('/messaging/reminders', data).then((r) => r.data),

  listMessages: (page = 1, limit = 50) =>
    apiClient
      .get<{ data: SmsMessage[]; meta: { total: number; totalPages: number } }>('/messaging/messages', { params: { page, limit } })
      .then((r) => r.data),

  // Inbox
  listThreads: (page = 1, limit = 30) =>
    apiClient
      .get<{ data: MessageThread[]; meta: { total: number; totalPages: number } }>('/messaging/inbox', { params: { page, limit } })
      .then((r) => r.data),

  getThread: (id: string) =>
    apiClient.get<MessageThread>(`/messaging/inbox/${id}`).then((r) => r.data),

  reply: (id: string, content: string) =>
    apiClient.post<ThreadMessage>(`/messaging/inbox/${id}/reply`, { content }).then((r) => r.data),

  unreadCount: () =>
    apiClient.get<{ count: number }>('/messaging/inbox/unread').then((r) => r.data),

  // Templates
  listTemplates: () =>
    apiClient.get<MessageTemplate[]>('/messaging/templates').then((r) => r.data),

  createTemplate: (data: { name: string; content: string; category?: string; language?: string }) =>
    apiClient.post<MessageTemplate>('/messaging/templates', data).then((r) => r.data),

  updateTemplate: (id: string, data: Partial<MessageTemplate>) =>
    apiClient.patch<MessageTemplate>(`/messaging/templates/${id}`, data).then((r) => r.data),

  deleteTemplate: (id: string) =>
    apiClient.delete(`/messaging/templates/${id}`).then((r) => r.data),

  // Segments
  listSegments: () =>
    apiClient.get<CustomerSegment[]>('/messaging/segments').then((r) => r.data),

  previewSegment: (filters: SegmentFilters, page = 1, limit = 50) =>
    apiClient.post<{ data: SegmentCustomer[]; meta: { total: number; totalPages: number } }>(
      '/messaging/segments/preview', { filters, page, limit }
    ).then((r) => r.data),

  createSegment: (data: { name: string; description?: string; filters: SegmentFilters }) =>
    apiClient.post<CustomerSegment>('/messaging/segments', data).then((r) => r.data),

  updateSegment: (id: string, data: Partial<{ name: string; description: string; filters: SegmentFilters }>) =>
    apiClient.patch<CustomerSegment>(`/messaging/segments/${id}`, data).then((r) => r.data),

  deleteSegment: (id: string) =>
    apiClient.delete(`/messaging/segments/${id}`).then((r) => r.data),
};
