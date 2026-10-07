import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  MapPin,
  Home,
  Briefcase,
  Plus,
  Check,
  Trash2,
  X,
  ChevronLeft,
} from 'lucide-react-native';
import { Address } from '../services/orderService';
import { useAddressStore } from '../store/addressStore';
import { LocationPickerModal } from './LocationPickerModal';

interface AddressSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelected?: (address: Address) => void;
}

export const AddressSelectorModal: React.FC<AddressSelectorModalProps> = ({
  visible,
  onClose,
  onAddressSelected,
}) => {
  const { addresses, selectedAddress, selectAddress, deleteAddress, isLoading } = useAddressStore();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getAddressIcon = (title: string) => {
    if (title.includes('منزل') || title.toLowerCase().includes('home')) {
      return <Home size={20} color="#D70F64" />;
    }
    if (title.includes('عمل') || title.toLowerCase().includes('work')) {
      return <Briefcase size={20} color="#D70F64" />;
    }
    return <MapPin size={20} color="#D70F64" />;
  };

  const handleSelect = async (addr: Address) => {
    await selectAddress(addr);
    if (onAddressSelected) {
      onAddressSelected(addr);
    }
    onClose();
  };

  const handleDelete = async (e: any, id: string) => {
    e.stopPropagation?.();
    if (window.confirm ? window.confirm('هل أنت متأكد من حذف هذا العنوان؟') : true) {
      setDeletingId(id);
      await deleteAddress(id);
      setDeletingId(null);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.dismissOverlay} activeOpacity={1} onPress={onClose} />

          <View style={styles.sheetContainer}>
            {/* Top Drag Handle & Close */}
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>اختر عنوان التوصيل</Text>
              <View style={{ width: 36 }} />
            </View>

            {/* List of Addresses */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
              {isLoading && addresses.length === 0 ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color="#D70F64" />
                  <Text style={styles.loadingText}>جاري تحميل العناوين...</Text>
                </View>
              ) : addresses.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <MapPin size={32} color="#D70F64" />
                  </View>
                  <Text style={styles.emptyTitle}>لا توجد عناوين محفوظة بعد</Text>
                  <Text style={styles.emptySub}>
                    حدد موقعك عبر الخريطة لتصلك طلباتك لأدق نقطة في أسرع وقت.
                  </Text>
                </View>
              ) : (
                <View style={styles.addressesList}>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddress?.id === addr.id;
                    const isDeleting = deletingId === addr.id;

                    return (
                      <TouchableOpacity
                        key={addr.id}
                        onPress={() => handleSelect(addr)}
                        activeOpacity={0.8}
                        style={[
                          styles.addressCard,
                          isSelected && styles.addressCardSelected,
                        ]}
                      >
                        <View style={styles.cardHeader}>
                          <View style={styles.titleInfo}>
                            <View style={styles.iconContainer}>
                              {getAddressIcon(addr.title)}
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.titleWithBadge}>
                                <Text style={styles.addressTitleText}>{addr.title}</Text>
                                {addr.is_default && (
                                  <View style={styles.defaultBadge}>
                                    <Text style={styles.defaultBadgeText}>افتراضي</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.streetText} numberOfLines={2}>
                                {addr.street}
                              </Text>
                              {(addr.building_number || addr.floor || addr.apartment_number) && (
                                <Text style={styles.extraDetailsText}>
                                  {[
                                    addr.building_number ? `عمارة: ${addr.building_number}` : '',
                                    addr.floor ? `دور: ${addr.floor}` : '',
                                    addr.apartment_number ? `شقة: ${addr.apartment_number}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Action Side */}
                          <View style={styles.actionsSide}>
                            {isSelected ? (
                              <View style={styles.selectedCircle}>
                                <Check size={16} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            ) : (
                              <View style={styles.unselectedCircle} />
                            )}

                            <TouchableOpacity
                              onPress={(e) => handleDelete(e, addr.id)}
                              disabled={isDeleting}
                              style={styles.deleteBtn}
                            >
                              {isDeleting ? (
                                <ActivityIndicator size="small" color="#9CA3AF" />
                              ) : (
                                <Trash2 size={16} color="#9CA3AF" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Bottom Add Address Button */}
            <View style={styles.bottomActionArea}>
              <TouchableOpacity
                onPress={() => setShowLocationPicker(true)}
                style={styles.addNewAddressBtn}
              >
                <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.addNewAddressText}>إضافة عنوان جديد عبر الخريطة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Google Map Location Picker */}
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSaved={(newAddress) => {
          setShowLocationPicker(false);
          if (onAddressSelected) {
            onAddressSelected(newAddress);
          }
          onClose();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: 340,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  scrollArea: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  centerLoading: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  addressesList: {
    gap: 12,
    paddingBottom: 10,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
  },
  addressCardSelected: {
    borderColor: '#D70F64',
    backgroundColor: '#FFF1F2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  defaultBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  streetText: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 3,
    lineHeight: 18,
    textAlign: 'right',
  },
  extraDetailsText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'right',
  },
  actionsSide: {
    alignItems: 'center',
    gap: 12,
    marginLeft: 10,
  },
  selectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D70F64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  deleteBtn: {
    padding: 4,
  },
  bottomActionArea: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D70F64',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#D70F64',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  addNewAddressText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
