import { api, ApiResponse } from './api';

export interface SupportMessage {
  id: string;
  ticket?: string;
  sender_name: string;
  sender_role: string;
  message_text: string;
  created_at: string;
}

export interface SupportTicketItem {
  id: string;
  ticket_number: string;
  user_name: string;
  order?: string | null;
  order_number?: string | null;
  category: string;
  category_display: string;
  priority: string;
  priority_display: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  status_display: string;
  subject: string;
  assigned_agent_name?: string | null;
  last_message?: {
    sender_name: string;
    message_text: string;
    created_at: string;
  } | null;
  messages?: SupportMessage[];
  created_at: string;
  updated_at: string;
}

export interface CreateTicketPayload {
  subject: string;
  category: string;
  priority?: string;
  initial_message: string;
  order?: string;
}

export const supportService = {
  async getTickets(): Promise<ApiResponse<SupportTicketItem[]>> {
    return api.get<SupportTicketItem[]>('/api/v1/support/tickets/');
  },

  async getTicketDetail(id: string): Promise<ApiResponse<SupportTicketItem>> {
    return api.get<SupportTicketItem>(`/api/v1/support/tickets/${id}/`);
  },

  async createTicket(data: CreateTicketPayload): Promise<ApiResponse<SupportTicketItem>> {
    return api.post<SupportTicketItem>('/api/v1/support/tickets/', data);
  },

  async addMessage(ticketId: string, messageText: string): Promise<ApiResponse<SupportMessage>> {
    return api.post<SupportMessage>(`/api/v1/support/tickets/${ticketId}/messages/`, {
      message_text: messageText,
    });
  },

  async closeTicket(ticketId: string): Promise<ApiResponse<SupportTicketItem>> {
    return api.patch<SupportTicketItem>(`/api/v1/support/tickets/${ticketId}/status/`, {
      status: 'CLOSED',
    });
  },
};
