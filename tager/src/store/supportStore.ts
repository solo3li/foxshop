import { create } from 'zustand';
import { api } from '../api/client';
import type { SupportTicket, TicketMessage } from '../types';

interface SupportState {
  tickets: SupportTicket[];
  activeTicket: SupportTicket | null;
  activeFilter: 'ALL' | 'OPEN' | 'CLOSED';
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  setActiveFilter: (filter: 'ALL' | 'OPEN' | 'CLOSED') => void;
  setActiveTicket: (ticket: SupportTicket | null) => void;
  fetchTickets: () => Promise<void>;
  fetchTicketDetail: (ticketId: string) => Promise<void>;
  createTicket: (data: FormData | { subject: string; initial_message: string; category: string; priority: string; order?: string }) => Promise<SupportTicket | null>;
  sendMessage: (ticketId: string, messageText: string, attachment?: File | Blob) => Promise<boolean>;
  closeTicket: (ticketId: string) => Promise<boolean>;
}

export const useSupportStore = create<SupportState>((set, get) => ({
  tickets: [],
  activeTicket: null,
  activeFilter: 'ALL',
  isLoading: false,
  isSending: false,
  error: null,

  setActiveFilter: (filter) => {
    set({ activeFilter: filter });
  },

  setActiveTicket: (ticket) => {
    set({ activeTicket: ticket });
    if (ticket) {
      // Refresh full details including messages
      get().fetchTicketDetail(ticket.id);
    }
  },

  fetchTickets: async () => {
    set({ isLoading: true, error: null });
    const res = await api.getSupportTickets();
    if (res.data) {
      set({ tickets: res.data, isLoading: false });
      // If activeTicket is selected, keep it updated
      const currentActive = get().activeTicket;
      if (currentActive) {
        const updated = res.data.find(t => t.id === currentActive.id);
        if (updated) {
          set({ activeTicket: { ...currentActive, ...updated } });
        }
      }
    } else {
      set({ error: res.error, isLoading: false });
    }
  },

  fetchTicketDetail: async (ticketId) => {
    const res = await api.getTicketDetail(ticketId);
    if (res.data) {
      set({ activeTicket: res.data });
      // Update in list as well
      set({
        tickets: get().tickets.map(t => t.id === ticketId ? { ...t, ...res.data! } : t)
      });
    }
  },

  createTicket: async (data) => {
    set({ isSending: true, error: null });
    const res = await api.createSupportTicket(data);
    set({ isSending: false });

    if (res.data) {
      // Add to list and set as active
      set({
        tickets: [res.data, ...get().tickets],
        activeTicket: res.data
      });
      // Fetch full details
      await get().fetchTicketDetail(res.data.id);
      return res.data;
    } else {
      set({ error: res.error });
      return null;
    }
  },

  sendMessage: async (ticketId, messageText, attachment) => {
    set({ isSending: true });

    let payload: FormData | { message_text: string };
    if (attachment) {
      const fd = new FormData();
      fd.append('message_text', messageText || 'مرفق وسائط');
      fd.append('attachment', attachment);
      payload = fd;
    } else {
      payload = { message_text: messageText };
    }

    const res = await api.sendTicketMessage(ticketId, payload);
    set({ isSending: false });

    if (res.data) {
      // Append message to activeTicket
      const currentActive = get().activeTicket;
      if (currentActive && currentActive.id === ticketId) {
        const existingMessages = currentActive.messages || [];
        set({
          activeTicket: {
            ...currentActive,
            messages: [...existingMessages, res.data],
            status: currentActive.status === 'WAITING_USER' ? 'IN_PROGRESS' : currentActive.status
          }
        });
      }
      return true;
    }
    return false;
  },

  closeTicket: async (ticketId) => {
    const res = await api.closeSupportTicket(ticketId);
    if (res.data) {
      set({
        activeTicket: res.data,
        tickets: get().tickets.map(t => t.id === ticketId ? res.data! : t)
      });
      return true;
    }
    return false;
  }
}));
