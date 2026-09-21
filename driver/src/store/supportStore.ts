import { create } from 'zustand';
import { api } from '../services/api';
import { centrifugo } from '../services/centrifugo';

export interface TicketMessage {
  id: string;
  ticket: string;
  sender: string;
  sender_name: string;
  sender_role: string;
  message_text: string;
  attachment?: string | null;
  attachment_type?: 'image' | 'audio' | 'video' | 'file' | null;
  is_internal_note: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user: string;
  user_name: string;
  user_role: string;
  order?: string | null;
  order_number?: string | null;
  category: string;
  category_display: string;
  priority: string;
  priority_display: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  status_display: string;
  subject: string;
  assigned_agent?: string | null;
  assigned_agent_name?: string | null;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
  messages?: TicketMessage[];
}

interface CreateTicketPayload {
  subject: string;
  category: string;
  order_id?: string | null;
  initial_message?: string;
  file?: any;
}

interface SupportState {
  tickets: SupportTicket[];
  activeTicket: SupportTicket | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  fetchTickets: () => Promise<void>;
  fetchTicketDetail: (ticketId: string) => Promise<SupportTicket | null>;
  createTicket: (payload: CreateTicketPayload) => Promise<SupportTicket | null>;
  sendMessage: (ticketId: string, messageText: string, file?: any) => Promise<boolean>;
  closeTicket: (ticketId: string) => Promise<boolean>;
  addIncomingMessage: (ticketId: string, message: TicketMessage) => void;
  clearActiveTicket: () => void;
}

export const useSupportStore = create<SupportState>((set, get) => ({
  tickets: [],
  activeTicket: null,
  isLoading: false,
  isSending: false,
  error: null,

  fetchTickets: async () => {
    set({ isLoading: true, error: null });
    const res = await api.get<SupportTicket[]>('/api/v1/support/tickets/');
    if (res.data) {
      set({ tickets: res.data, isLoading: false });
    } else {
      set({ isLoading: false, error: res.error || 'فشل جلب تذاكر الدعم' });
    }
  },

  fetchTicketDetail: async (ticketId: string) => {
    set({ isLoading: true, error: null });
    const res = await api.get<SupportTicket>(`/api/v1/support/tickets/${ticketId}/`);
    if (res.data) {
      set({ activeTicket: res.data, isLoading: false });
      return res.data;
    } else {
      set({ isLoading: false, error: res.error || 'فشل جلب تفاصيل التذكرة' });
      return null;
    }
  },

  createTicket: async (payload: CreateTicketPayload) => {
    set({ isSending: true, error: null });
    const createData: any = {
      subject: payload.subject,
      category: payload.category,
      priority: 'MEDIUM',
    };
    if (payload.order_id) {
      createData.order = payload.order_id;
    }
    if (payload.initial_message) {
      createData.initial_message = payload.initial_message;
    }

    const res = await api.post<SupportTicket>('/api/v1/support/tickets/', createData);
    if (!res.data) {
      set({ isSending: false, error: res.error || 'فشل إنشاء تذكرة الدعم' });
      return null;
    }

    const newTicket = res.data;

    // If an initial media file was attached, send it as message
    if (payload.file) {
      const formData = new FormData();
      formData.append('message_text', payload.initial_message || 'مرفق وسائط');
      formData.append('attachment', payload.file);
      await api.post(`/api/v1/support/tickets/${newTicket.id}/messages/`, formData);
    }

    // Refresh tickets list
    await get().fetchTickets();
    set({ isSending: false, activeTicket: newTicket });
    return newTicket;
  },

  sendMessage: async (ticketId: string, messageText: string, file?: any) => {
    set({ isSending: true, error: null });

    let res: any;
    if (file) {
      const formData = new FormData();
      formData.append('message_text', messageText || '');
      formData.append('attachment', file);
      res = await api.post<TicketMessage>(`/api/v1/support/tickets/${ticketId}/messages/`, formData);
    } else {
      res = await api.post<TicketMessage>(`/api/v1/support/tickets/${ticketId}/messages/`, {
        message_text: messageText,
      });
    }

    set({ isSending: false });

    if (!res.data) {
      set({ error: res.error || 'فشل إرسال الرسالة' });
      return false;
    }

    const newMsg = res.data;
    const currentActive = get().activeTicket;
    if (currentActive && currentActive.id === ticketId) {
      const exists = (currentActive.messages || []).some((m) => m.id === newMsg.id);
      if (!exists) {
        set({
          activeTicket: {
            ...currentActive,
            messages: [...(currentActive.messages || []), newMsg],
          },
        });
      }
    }

    return true;
  },

  closeTicket: async (ticketId: string) => {
    const res = await api.patch(`/api/v1/support/tickets/${ticketId}/status/`, {
      status: 'CLOSED',
    });
    if (res.data) {
      const currentActive = get().activeTicket;
      if (currentActive && currentActive.id === ticketId) {
        set({
          activeTicket: {
            ...currentActive,
            status: 'CLOSED',
            status_display: 'مغلقة',
          },
        });
      }
      await get().fetchTickets();
      return true;
    }
    return false;
  },

  addIncomingMessage: (ticketId: string, message: TicketMessage) => {
    const currentActive = get().activeTicket;
    if (currentActive && currentActive.id === ticketId) {
      const exists = (currentActive.messages || []).some((m) => m.id === message.id);
      if (!exists) {
        set({
          activeTicket: {
            ...currentActive,
            messages: [...(currentActive.messages || []), message],
          },
        });
      }
    }
  },

  clearActiveTicket: () => set({ activeTicket: null }),
}));
