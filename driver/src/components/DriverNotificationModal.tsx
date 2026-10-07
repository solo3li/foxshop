import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import {
  driverNotificationService,
  DriverNotification,
} from '../services/notificationService';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  Package,
  Tag,
  Info,
  Circle,
} from 'lucide-react-native';

interface DriverNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onNotificationsUpdated?: (unreadCount: number) => void;
}

export const DriverNotificationModal: React.FC<DriverNotificationModalProps> = ({
  visible,
  onClose,
  onNotificationsUpdated,
}) => {
  const { colors } = useThemeStore();
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await driverNotificationService.getNotifications();
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
        onNotificationsUpdated?.(res.data.unread_count || 0);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await driverNotificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      onNotificationsUpdated?.(Math.max(0, unreadCount - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await driverNotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onNotificationsUpdated?.(0);
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await driverNotificationService.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      onNotificationsUpdated?.(0);
    } catch {}
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package size={20} color={colors.primary} />;
      case 'promo':
        return <Tag size={20} color={colors.secondary} />;
      default:
        return <Info size={20} color={colors.warning} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.bold }]}>
                مركز الإشعارات والتنبيهات 🔔
              </Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.unreadBadgeText, { fontFamily: Fonts.bold }]}>
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Action Bar */}
          {notifications.length > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                onPress={handleClearAll}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Trash2 size={14} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                  مسح الكل
                </Text>
              </TouchableOpacity>

              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                >
                  <CheckCheck size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: Fonts.medium }]}>
                    تحديد الكل كمقروء
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Body */}
          {loading && !refreshing ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Bell size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                لا توجد إشعارات حالياً
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                ستظهر هنا تنبيهات الطلبات الجديدة، العروض والمستجدات التشغيلية.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {notifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => !item.is_read && handleMarkAsRead(item.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.notificationItem,
                    {
                      backgroundColor: item.is_read ? colors.surface : colors.card,
                      borderColor: item.is_read ? colors.border : colors.primary,
                    },
                  ]}
                >
                  <View style={styles.iconContainer}>{renderIcon(item.notification_type)}</View>

                  <View style={styles.itemTextCol}>
                    <View style={styles.itemTitleRow}>
                      {!item.is_read && (
                        <Circle size={8} fill={colors.primary} color={colors.primary} />
                      )}
                      <Text
                        style={[
                          styles.itemTitle,
                          {
                            color: colors.text,
                            fontFamily: item.is_read ? Fonts.medium : Fonts.bold,
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                    </View>

                    <Text style={[styles.itemMessage, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                      {item.message}
                    </Text>

                    {item.order_number && (
                      <Text style={[styles.orderRef, { color: colors.primary, fontFamily: Fonts.bold }]}>
                        رقم الطلب: #{item.order_number}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    elevation: 8,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  listContent: {
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  notificationItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconContainer: {
    marginTop: 2,
  },
  itemTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  itemTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    textAlign: 'right',
  },
  itemMessage: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  orderRef: {
    fontSize: 11,
    marginTop: 2,
  },
});
