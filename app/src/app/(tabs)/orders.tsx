import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { orderService, OrderResponse } from '../../services/orderService';
import { useCartStore } from '../../store/cartStore';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  RotateCcw,
  Navigation,
  UtensilsCrossed,
  Receipt,
  Sparkles,
} from 'lucide-react-native';

export default function CustomerOrdersTab() {
  const router = useRouter();
  const { addItem } = useCartStore();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'HISTORY'>('ALL');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await orderService.getOrderHistory();
      if (res.data) {
        setOrders(res.data);
      }
    } catch (e) {
      console.warn('Failed to load customer orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const isOrderActive = (status: string) => {
    return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'ON_THE_WAY'].includes(
      status.toUpperCase()
    );
  };

  const filteredOrders = orders.filter((order) => {
    const active = isOrderActive(order.status);
    if (activeFilter === 'ACTIVE') return active;
    if (activeFilter === 'HISTORY') return !active;
    return true;
  });

  const activeOrdersCount = orders.filter((o) => isOrderActive(o.status)).length;

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'PENDING':
        return { label: 'بانتظار التأكيد ⏳', bg: '#FEF3C7', color: '#D97706' };
      case 'CONFIRMED':
        return { label: 'تم تأكيد الطلب 👍', bg: '#EFF6FF', color: '#2563EB' };
      case 'PREPARING':
        return { label: 'جاري التحضير بالمطعم 👨‍🍳', bg: '#FEF3C7', color: '#B45309' };
      case 'READY_FOR_PICKUP':
        return { label: 'جاهز للاستلام 🛍️', bg: '#F3E8FF', color: '#7E22CE' };
      case 'ON_THE_WAY':
        return { label: 'الكابتن في الطريق 🛵', bg: '#FCE7F3', color: '#D70F64' };
      case 'DELIVERED':
        return { label: 'تم التوصيل بنجاح ✅', bg: '#ECFDF5', color: '#059669' };
      case 'CANCELLED':
        return { label: 'تم الإلغاء ❌', bg: '#FEE2E2', color: '#DC2626' };
      default:
        return { label: status, bg: '#F3F4F6', color: '#4B5563' };
    }
  };

  const handleReorder = (order: OrderResponse) => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        addItem({
          id: item.id || `reorder-${Date.now()}-${Math.random()}`,
          name: item.item_name,
          price: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(item.unit_price || '0'),
          quantity: item.quantity,
          restaurantId: order.restaurant || '',
          restaurantName: order.restaurant_name,
        } as any);
      });
      router.push('/(tabs)/carts' as any);
    } else {
      router.push(`/order/${order.id}` as any);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>طلباتي 🛍️</Text>
          {activeOrdersCount > 0 && (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>{activeOrdersCount} جارية</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>تتبع طلباتك الحالية وسجل وجباتك السابقة</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersBar}>
        {(
          [
            { id: 'ALL', label: `الكل (${orders.length})` },
            { id: 'ACTIVE', label: `الحالية (${activeOrdersCount})` },
            { id: 'HISTORY', label: `السابقة (${orders.length - activeOrdersCount})` },
          ] as const
        ).map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id)}
              activeOpacity={0.8}
              style={[styles.filterTab, isSelected && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#FF2E7E" />
          <Text style={styles.loadingText}>جاري تحميل طلباتك...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.emptyIconCircle}>
            <UtensilsCrossed size={42} color="#D70F64" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد طلبات في هذا القسم</Text>
          <Text style={styles.emptyDesc}>
            {activeFilter === 'ACTIVE'
              ? 'ليس لديك أي طلبات جارية الآن. اطلب وجبتك المفضلة وسنبدأ في توصيلها فوراً!'
              : 'لم تقم بطلب أي وجبات بعد. تصفح أشهى المطاعم واستمتع بأقوى العروض!'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.8}
            style={styles.exploreBtn}
          >
            <Sparkles size={18} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>تصفح المطاعم وابدأ الطلب</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const active = isOrderActive(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => router.push(`/order/${order.id}` as any)}
                activeOpacity={0.88}
                style={[styles.orderCard, active && styles.orderCardActiveHighlight]}
              >
                {/* Top Row: Restaurant Name & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.restaurantMeta}>
                    <Text style={styles.restaurantName} numberOfLines={1}>
                      {order.restaurant_name || 'مطعم فوكس شوب'}
                    </Text>
                    <Text style={styles.orderNumber}>#{order.order_number}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Items Summary */}
                <View style={styles.itemsSummaryBox}>
                  {order.items && order.items.length > 0 ? (
                    <Text style={styles.itemsSummaryText} numberOfLines={2}>
                      {order.items.map((it) => `${it.quantity}x ${it.item_name}`).join(' • ')}
                    </Text>
                  ) : (
                    <Text style={styles.itemsSummaryText}>طلب وجبات متنوعة</Text>
                  )}
                </View>

                {/* Divider */}
                <View style={styles.cardDivider} />

                {/* Bottom Row: Amount & Actions */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>الإجمالي:</Text>
                    <Text style={styles.priceValue}>
                      {typeof order.total_amount === 'number'
                        ? order.total_amount.toFixed(2)
                        : parseFloat(String(order.total_amount) || '0').toFixed(2)}{' '}
                      ج.م
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    {active ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/order/${order.id}` as any)}
                        activeOpacity={0.8}
                        style={styles.trackBtn}
                      >
                        <Navigation size={15} color="#FFFFFF" />
                        <Text style={styles.trackBtnText}>تتبع مسار الطلب</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleReorder(order)}
                        activeOpacity={0.8}
                        style={styles.reorderBtn}
                      >
                        <RotateCcw size={14} color="#D70F64" />
                        <Text style={styles.reorderBtnText}>إعادة الطلب</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'flex-end',
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  activePill: {
    backgroundColor: '#FFF1F5',
    borderColor: '#FFE4E6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activePillText: {
    color: '#D70F64',
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'right',
  },
  filtersBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#FF2E7E',
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 90, // Leave room for floating bottom tab bar
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF1F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D70F64',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 10,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    gap: 10,
  },
  orderCardActiveHighlight: {
    borderColor: '#FF2E7E',
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantMeta: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  restaurantName: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  orderNumber: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  itemsSummaryBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
  },
  itemsSummaryText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
    lineHeight: 18,
    textAlign: 'right',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  cardFooterRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  trackBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D70F64',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  trackBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  reorderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F5',
    borderColor: '#FFE4E6',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  reorderBtnText: {
    color: '#D70F64',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
