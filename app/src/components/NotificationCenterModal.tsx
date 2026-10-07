import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { X, CheckCheck, Trash2, ShoppingBag, Tag, Bell, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { NotificationBellSvg } from './DiscoveryIcons';

export interface AppNotification {
  id: string;
  type: 'order' | 'promo' | 'system';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  orderId?: string;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'order',
    title: 'الكابتن في طريقه إليك! 🛵',
    message: 'الكابتن أحمد استلم طلبك من قصر الشاورما وهو في طريقه لعنوانك الآن.',
    time: 'منذ 10 دقائق',
    isRead: false,
    orderId: '#1042',
  },
  {
    id: 'n2',
    type: 'promo',
    title: 'خصم 20% على البيتزا والبرجر 🍕',
    message: 'استخدم كوبون FOX20 واحصل على خصم فوري 20% حتى نهاية اليوم.',
    time: 'منذ ساعتين',
    isRead: false,
  },
  {
    id: 'n3',
    type: 'order',
    title: 'تم توصيل طلبك بنجاح ✅',
    message: 'شكراً لطلبك من برجر فاكتوري! نتمنى أن تنال الوجبة إعجابك.',
    time: 'أمس 09:30 م',
    isRead: true,
    orderId: '#1039',
  },
  {
    id: 'n4',
    type: 'system',
    title: 'أهلاً بك في فوكس شوب 🦊',
    message: 'اكتشف أفضل المطاعم والمتاجر في مدينتك مع أسرع خدمة توصيل.',
    time: 'منذ يومين',
    isRead: true,
  },
];

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export default function NotificationCenterModal({
  visible,
  onClose,
  onNavigateToOrder,
}: NotificationCenterModalProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'promos'>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const toggleReadStatus = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const filteredList = notifications.filter((n) => {
    if (activeTab === 'orders') return n.type === 'order';
    if (activeTab === 'promos') return n.type === 'promo';
    return true;
  });

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return (
          <View style={[styles.itemIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <ShoppingBag size={20} color="#2563EB" />
          </View>
        );
      case 'promo':
        return (
          <View style={[styles.itemIconCircle, { backgroundColor: '#FDF2F8' }]}>
            <Tag size={20} color="#FF2E7E" />
          </View>
        );
      default:
        return (
          <View style={[styles.itemIconCircle, { backgroundColor: '#F3F4F6' }]}>
            <Bell size={20} color="#4B5563" />
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#1F2937" />
            </TouchableOpacity>

            <View style={styles.titleCenter}>
              <Text style={styles.sheetTitle}>مركز الإشعارات</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} جديد</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={styles.iconActionBtn} accessibilityLabel="قراءة الكل">
                  <CheckCheck size={18} color={Colors.light.primary} />
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAllNotifications} style={styles.iconActionBtn} accessibilityLabel="مسح">
                  <Trash2 size={17} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter Chips */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'all' && styles.activeTabChip]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabChipText, activeTab === 'all' && styles.activeTabChipText]}>
                الكل ({notifications.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'orders' && styles.activeTabChip]}
              onPress={() => setActiveTab('orders')}
            >
              <Text style={[styles.tabChipText, activeTab === 'orders' && styles.activeTabChipText]}>
                الطلبات ({notifications.filter((n) => n.type === 'order').length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabChip, activeTab === 'promos' && styles.activeTabChip]}
              onPress={() => setActiveTab('promos')}
            >
              <Text style={[styles.tabChipText, activeTab === 'promos' && styles.activeTabChipText]}>
                العروض ({notifications.filter((n) => n.type === 'promo').length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* List or Empty State */}
          {filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <NotificationBellSvg size={44} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد إشعارات حالياً</Text>
              <Text style={styles.emptyDesc}>
                ستصلك هنا تحديثات طلباتك الحية وخصومات فوكس شوب الحصرية!
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
                  activeOpacity={0.8}
                  onPress={() => {
                    toggleReadStatus(item.id);
                    if (item.orderId && onNavigateToOrder) {
                      onClose();
                      onNavigateToOrder(item.orderId);
                    }
                  }}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.timeText}>{item.time}</Text>
                    <View style={styles.titleWithDot}>
                      <Text style={[styles.itemTitle, !item.isRead && styles.boldTitle]}>
                        {item.title}
                      </Text>
                      {!item.isRead && <View style={styles.unreadDot} />}
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.itemMessage}>{item.message}</Text>
                    {renderIcon(item.type)}
                  </View>

                  {item.orderId && (
                    <View style={styles.trackOrderRow}>
                      <ChevronLeft size={16} color={Colors.light.primary} />
                      <Text style={styles.trackOrderText}>متابعة الطلب {item.orderId}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    minHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
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
  titleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: Colors.light.primary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  activeTabChip: {
    backgroundColor: Colors.light.primary,
  },
  tabChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  activeTabChipText: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  unreadCard: {
    backgroundColor: '#FFF7F9',
    borderColor: '#FECDD3',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  boldTitle: {
    fontWeight: 'bold',
    color: '#111827',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  cardBody: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMessage: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
    textAlign: 'right',
  },
  trackOrderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  trackOrderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
