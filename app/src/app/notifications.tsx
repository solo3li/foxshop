import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowRight, CheckCheck, Trash2, ShoppingBag, Tag, Bell, ChevronLeft, Copy, Check } from 'lucide-react-native';
import { useTheme } from '../hooks/use-theme';
import { NotificationBellSvg } from '../components/DiscoveryIcons';
import { notificationService, BackendNotification } from '../services/notificationService';
import { useAuthStore } from '../store/authStore';

interface AppNotification {
  id: string;
  type: 'order' | 'promo' | 'system';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  orderId?: string;
}

function formatTimestamp(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return date.toLocaleDateString('ar-EG');
  } catch {
    return 'مؤخراً';
  }
}

function extractPromoCode(title: string, message: string): string | null {
  const combined = `${title} ${message}`;
  const arabicMatch = combined.match(/(?:كود|برومو|رمز|كوبون)\s*[:：]?\s*([A-Za-z0-9_-]{4,18})/);
  if (arabicMatch && arabicMatch[1]) return arabicMatch[1].toUpperCase();
  const codeMatch = combined.match(/\b([A-Z0-9]{4,16})\b/);
  return codeMatch ? codeMatch[1] : null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { isAuthenticated } = useAuthStore();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'order' | 'promo'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = (notifId: string, code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedId(notifId);
    setTimeout(() => setCopiedId((curr) => (curr === notifId ? null : curr)), 2000);
  };

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await notificationService.getNotifications();
      if (res.data?.notifications) {
        const mapped: AppNotification[] = res.data.notifications.map((n: BackendNotification) => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          message: n.message,
          time: formatTimestamp(n.created_at),
          isRead: n.is_read,
          orderId: n.order || undefined,
        }));
        setNotifications(mapped);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (isAuthenticated) {
      await notificationService.markAllAsRead();
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    if (isAuthenticated) {
      await notificationService.clearAll();
    }
  };

  const handlePressNotification = async (item: AppNotification) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      if (isAuthenticated) {
        await notificationService.markAsRead(item.id);
      }
    }
    if (item.orderId) {
      router.push('/(tabs)/orders' as any);
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const getTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return {
          icon: <ShoppingBag size={20} color="#D70F64" />,
          bg: theme.isDark ? 'rgba(215,15,100,0.18)' : '#FDF2F8',
        };
      case 'promo':
        return {
          icon: <Tag size={20} color="#F59E0B" />,
          bg: theme.isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7',
        };
      default:
        return {
          icon: <Bell size={20} color="#3B82F6" />,
          bg: theme.isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF',
        };
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
          activeOpacity={0.7}
        >
          <ArrowRight size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>الإشعارات</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Actions Bar */}
      {notifications.length > 0 && (
        <View style={styles.actionsBar}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[styles.actionBtn, { backgroundColor: theme.surfaceSecondary }]}
            activeOpacity={0.7}
          >
            <CheckCheck size={15} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>تحديد الكل كمقروء</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.actionBtn, { backgroundColor: theme.surfaceSecondary }]}
            activeOpacity={0.7}
          >
            <Trash2 size={15} color={theme.textSecondary} />
            <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>مسح الكل</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Clean Filter Pills */}
      {notifications.length > 0 && (
        <View style={styles.filtersRow}>
          {[
            { id: 'all' as const, label: `الكل (${notifications.length})` },
            { id: 'order' as const, label: `الطلبات (${notifications.filter((n) => n.type === 'order').length})` },
            { id: 'promo' as const, label: `العروض (${notifications.filter((n) => n.type === 'promo').length})` },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilter(tab.id)}
                style={[
                  styles.filterPill,
                  { backgroundColor: active ? theme.primary : theme.surfaceSecondary },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* List / Loading / Clean Empty State */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            filteredList.length === 0 && { flex: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceSecondary }]}>
                <NotificationBellSvg size={38} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>لا توجد إشعارات</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {isAuthenticated
                  ? 'ستظهر هنا تنبيهات الطلبات والعروض الجديدة فور وصولها'
                  : 'سجّل الدخول لمتابعة إشعارات طلباتك وعروضك الخاصة'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const typeVisual = getTypeIcon(item.type);
            const promoCode = item.type === 'promo' ? extractPromoCode(item.title, item.message) : null;
            const isCopied = copiedId === item.id;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePressNotification(item)}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: !item.isRead
                      ? theme.isDark
                        ? 'rgba(215, 15, 100, 0.08)'
                        : '#FFF9FB'
                      : theme.card,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.iconWrapper, { backgroundColor: typeVisual.bg }]}>
                    {typeVisual.icon}
                  </View>

                  <View style={styles.textContainer}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!item.isRead && (
                        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                      )}
                    </View>

                    <Text style={[styles.cardMessage, { color: theme.textSecondary }]} numberOfLines={3}>
                      {item.message}
                    </Text>

                    <View style={styles.cardFooterRow}>
                      <Text style={[styles.cardTime, { color: theme.textMuted }]}>{item.time}</Text>
                      {promoCode && (
                        <TouchableOpacity
                          style={[
                            styles.copyCodePill,
                            { backgroundColor: isCopied ? '#ECFDF5' : theme.primaryLight },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleCopyCode(item.id, promoCode)}
                        >
                          {isCopied ? (
                            <Check size={13} color="#059669" />
                          ) : (
                            <Copy size={13} color={theme.primary} />
                          )}
                          <Text
                            style={[
                              styles.copyCodeText,
                              { color: isCopied ? '#059669' : theme.primary },
                            ]}
                          >
                            {isCopied ? `تم نسخ ${promoCode}` : `نسخ الكود: ${promoCode}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {item.orderId && (
                        <View style={styles.orderLinkRow}>
                          <Text style={[styles.orderLinkText, { color: theme.primary }]}>
                            متابعة الطلب
                          </Text>
                          <ChevronLeft size={14} color={theme.primary} />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontFamily: 'Tajawal_700Bold',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  notificationCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'left',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardMessage: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    lineHeight: 20,
    textAlign: 'left',
    marginBottom: 8,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTime: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  orderLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  orderLinkText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  copyCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  copyCodeText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
