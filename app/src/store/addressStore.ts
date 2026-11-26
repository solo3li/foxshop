import { create } from 'zustand';
import { Address, orderService } from '../services/orderService';
import { storage } from '../services/storage';
import { DEFAULT_COORDINATES } from '../constants/config';

interface AddressState {
  addresses: Address[];
  selectedAddress: Address | null;
  isLoading: boolean;
  error: string | null;

  fetchAddresses: () => Promise<Address[]>;
  selectAddress: (address: Address) => Promise<void>;
  createAddress: (payload: Partial<Address>) => Promise<Address | null>;
  deleteAddress: (id: string) => Promise<boolean>;
  setDefaultAddress: (id: string) => Promise<boolean>;
  loadSavedSelection: () => Promise<void>;
}

const STORAGE_KEY_SELECTED_ADDRESS_ID = 'foxshop_selected_address_id';
const STORAGE_KEY_GUEST_ADDRESS = 'foxshop_guest_address';

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddress: null,
  isLoading: false,
  error: null,

  loadSavedSelection: async () => {
    try {
      const savedId = await storage.getItem(STORAGE_KEY_SELECTED_ADDRESS_ID);
      const { addresses, selectedAddress } = get();
      if (savedId && addresses.length > 0) {
        const found = addresses.find((a) => a.id === savedId);
        if (found) {
          set({ selectedAddress: found });
          return;
        }
      }
      if (!selectedAddress && addresses.length > 0) {
        const def = addresses.find((a) => a.is_default) || addresses[0];
        set({ selectedAddress: def });
      }
    } catch (e) {
      // ignore
    }
  },

  fetchAddresses: async () => {
    const token = await storage.getItem('foxshop_access_token');
    
    // If user is not logged in (Guest mode), load locally saved guest address
    if (!token) {
      try {
        const savedGuest = await storage.getItem(STORAGE_KEY_GUEST_ADDRESS);
        if (savedGuest) {
          const guestAddr = JSON.parse(savedGuest) as Address;
          set({ addresses: [guestAddr], selectedAddress: guestAddr, isLoading: false, error: null });
          return [guestAddr];
        }
      } catch (e) {
        // ignore
      }
      set({ addresses: [], selectedAddress: null, isLoading: false, error: null });
      return [];
    }

    // Authenticated user: fetch from API
    set({ isLoading: true, error: null });
    try {
      const res = await orderService.getAddresses();
      if (res.data) {
        const addrs = res.data;
        let selected = get().selectedAddress;
        
        // Check if previously selected address still exists
        if (selected) {
          const current = addrs.find((a) => a.id === selected?.id);
          selected = current || null;
        }

        if (!selected && addrs.length > 0) {
          const savedId = await storage.getItem(STORAGE_KEY_SELECTED_ADDRESS_ID);
          selected = addrs.find((a) => a.id === savedId) || addrs.find((a) => a.is_default) || addrs[0];
        }

        set({ addresses: addrs, selectedAddress: selected, isLoading: false });
        return addrs;
      }
      set({ isLoading: false });
      return [];
    } catch (err: any) {
      set({ error: err.message || 'فشل جلب العناوين', isLoading: false });
      return [];
    }
  },

  selectAddress: async (address: Address) => {
    set({ selectedAddress: address });
    try {
      await storage.setItem(STORAGE_KEY_SELECTED_ADDRESS_ID, address.id);
    } catch (e) {
      // ignore
    }
  },

  createAddress: async (payload: Partial<Address>) => {
    set({ isLoading: true, error: null });

    const token = await storage.getItem('foxshop_access_token');

    // Guest mode: save locally without calling protected API
    if (!token) {
      const guestAddr: Address = {
        id: 'guest-' + Date.now(),
        title: payload.title || 'موقعي الحالي',
        street: payload.street || 'الموقع المحدد على الخريطة',
        building_number: payload.building_number || '',
        floor: payload.floor || '',
        apartment_number: payload.apartment_number || '',
        delivery_instructions: payload.delivery_instructions || '',
        latitude: payload.latitude || DEFAULT_COORDINATES.latitude,
        longitude: payload.longitude || DEFAULT_COORDINATES.longitude,
        is_default: true,
      };

      try {
        await storage.setItem(STORAGE_KEY_GUEST_ADDRESS, JSON.stringify(guestAddr));
        await storage.setItem(STORAGE_KEY_SELECTED_ADDRESS_ID, guestAddr.id);
      } catch (e) {
        // ignore
      }

      set({
        addresses: [guestAddr],
        selectedAddress: guestAddr,
        isLoading: false,
        error: null,
      });

      return guestAddr;
    }

    // Authenticated user: save to backend API
    try {
      const res = await orderService.createAddress(payload);
      if (res.data) {
        const newAddr = res.data;
        const currentList = get().addresses;
        const updatedList = [newAddr, ...currentList.filter((a) => a.id !== newAddr.id)];
        
        set({
          addresses: updatedList,
          selectedAddress: newAddr,
          isLoading: false,
          error: null,
        });

        try {
          await storage.setItem(STORAGE_KEY_SELECTED_ADDRESS_ID, newAddr.id);
        } catch (e) {
          // ignore
        }

        return newAddr;
      }
      set({ isLoading: false, error: res.error || 'فشل إنشاء العنوان' });
      return null;
    } catch (err: any) {
      set({ error: err.message || 'حدث خطأ أثناء حفظ العنوان', isLoading: false });
      return null;
    }
  },

  deleteAddress: async (id: string) => {
    const token = await storage.getItem('foxshop_access_token');
    
    // Guest mode: clear local guest address
    if (!token) {
      try {
        await storage.removeItem(STORAGE_KEY_GUEST_ADDRESS);
        await storage.removeItem(STORAGE_KEY_SELECTED_ADDRESS_ID);
      } catch (e) {
        // ignore
      }
      set({ addresses: [], selectedAddress: null });
      return true;
    }

    // Authenticated user
    try {
      const res = await orderService.deleteAddress(id);
      if (res.status === 204 || res.status === 200 || !res.error) {
        const remaining = get().addresses.filter((a) => a.id !== id);
        let currentSelected = get().selectedAddress;
        if (currentSelected?.id === id) {
          currentSelected = remaining.find((a) => a.is_default) || remaining[0] || null;
        }
        set({ addresses: remaining, selectedAddress: currentSelected });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  setDefaultAddress: async (id: string) => {
    try {
      const res = await orderService.setDefaultAddress(id);
      if (res.data) {
        const updated = get().addresses.map((a) => ({
          ...a,
          is_default: a.id === id,
        }));
        set({ addresses: updated });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },
}));
