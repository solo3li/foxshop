import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore, DeliveryTrip } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Store, User, ChevronLeft, MapPin, Package, Clock } from 'lucide-react-native';

export default function DriverTripsScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { tripsHistory, fetchTripsHistory, isLoading } = useTripStore();
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTripsHistory(selectedFilter);
  }, [selectedFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTripsHistory(selectedFilter);
    setRefreshing(false);
  };

  const filters = [
    { key: 'ALL', label: 'الكل' },
    { key: 'ACTIVE', label: 'النشطة' },
    { key: 'COMPLETED', label: 'المكتملة' },
    { key: 'CANCELLED', label: 'الملغاة' },
  ] as const;

  const getStatusBadge = (status: DeliveryTrip['status']) => {
    switch (status) {
      case 'COMPLETED':
        return { label: 'مكتمل', bg: colors.successLight, text: colors.success };
      case 'CANCELLED':
        return { label: 'ملغي', bg: colors.dangerLight, text: colors.danger };
      case 'OFFERED':
        return { label: 'معروض', bg: colors.warningLight, text: colors.warning };
      default:
        return { label: 'قيد التوصيل', bg: colors.primaryLight, text: colors.primary };
    }
  };

  const renderTripCard = ({ item }: { item: DeliveryTrip }) => {
    const badge = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/trip/${item.id}`)}
        activeOpacity={0.8}
        style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Top Card Row */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text, fontFamily: Fonts.bold }]}>
              {badge.label}
            </Text>
          </View>
          <Text style={[styles.orderNumber, { color: colors.text, fontFamily: Fonts.bold }]}>
            طلب #{item.order_number}
          </Text>
        </View>

        {/* Mid Card Row: Restaurant & Customer */}
        <View style={styles.detailsRow}>
          <View style={styles.locationItem}>
            <View style={[styles.miniIcon, { backgroundColor: colors.surface }]}>
              <Store size={14} color={colors.primary} />
            </View>
            <Text numberOfLines={1} style={[styles.locationName, { color: colors.text, fontFamily: Fonts.medium }]}>
              {item.restaurant?.name || 'المطعم'}
            </Text>
          </View>

          <View style={styles.locationItem}>
            <View style={[styles.miniIcon, { backgroundColor: colors.surface }]}>
              <User size={14} color={colors.secondary} />
            </View>
            <Text numberOfLines={1} style={[styles.locationName, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              {item.customer ? `${item.customer.first_name} ${item.customer.last_name}` : 'العميل'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Footer: Earnings & Details Arrow */}
        <View style={styles.cardFooter}>
          <View style={styles.earningsContainer}>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              أرباح الرحلة:
            </Text>
            <Text style={[styles.earningsValue, { color: colors.primary, fontFamily: Fonts.bold }]}>
              {item.driver_earnings} ج.م
            </Text>
          </View>

          <View style={styles.viewDetailsRow}>
            <Text style={[styles.viewDetailsText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              تفاصيل
            </Text>
            <ChevronLeft size={16} color={colors.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title */}
      <View style={[styles.screenHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          سجل الرحلات والمشاوير
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        {filters.map((f) => {
          const isSelected = selectedFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setSelectedFilter(f.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontFamily: isSelected ? Fonts.bold : Fonts.medium,
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Trips FlatList */}
      <FlatList
        data={tripsHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderTripCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Package size={52} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                لا توجد مشاوير في هذا القسم
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                عندما تبدأ في استقبال الرحلات وإنهاء التوصيل ستظهر هنا بالتفصيل
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
  },
  screenTitle: {
    fontSize: 18,
  },
  filtersContainer: {
    flexDirection: 'row-reverse',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    flexGrow: 1,
  },
  tripCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
  },
  orderNumber: {
    fontSize: 15,
  },
  detailsRow: {
    gap: 6,
    marginTop: 2,
  },
  locationItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  miniIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationName: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  earningsLabel: {
    fontSize: 12,
  },
  earningsValue: {
    fontSize: 15,
  },
  viewDetailsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: '80%',
  },
});
