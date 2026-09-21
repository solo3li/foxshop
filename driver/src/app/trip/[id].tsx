import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../services/api';
import { DeliveryTrip } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Store, User, Phone, Navigation, DollarSign, Calendar, Clock, ArrowRight, Package } from 'lucide-react-native';
import { openExternalNavigation } from '../../utils/navigation';

export default function DriverTripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useThemeStore();

  const [trip, setTrip] = useState<DeliveryTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      setLoading(true);
      const res = await api.get(`/api/v1/driver/trips/${id}/`);
      if (res.data) {
        setTrip(res.data);
      } else {
        setError(res.error || 'تعذر تحميل بيانات الرحلة');
      }
      setLoading(false);
    };

    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.bold }]}>
          {error || 'الرحلة غير موجودة'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: colors.primary, fontFamily: Fonts.medium }}>العودة لمشاويري</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Header Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={[styles.statusBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.statusText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                {trip.status_display || trip.status}
              </Text>
            </View>
            <Text style={[styles.orderNumber, { color: colors.text, fontFamily: Fonts.extraBold }]}>
              طلب #{trip.order_number}
            </Text>
          </View>

          <View style={styles.timestampRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={[styles.timestampText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              تاريخ الطلب: {new Date(trip.offered_at).toLocaleString('ar-EG')}
            </Text>
          </View>

          {/* Big Earnings Box */}
          <View style={[styles.earningsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              أرباحك المحققة من التوصيل
            </Text>
            <View style={styles.earningsValueRow}>
              <Text style={[styles.currency, { color: colors.primary, fontFamily: Fonts.bold }]}>ج.م</Text>
              <Text style={[styles.earningsValue, { color: colors.primary, fontFamily: Fonts.extraBold }]}>
                {trip.driver_earnings}
              </Text>
            </View>
          </View>
        </View>

        {/* Restaurant Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Store size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              تفاصيل المطعم
            </Text>
          </View>

          <Text style={[styles.entityName, { color: colors.text, fontFamily: Fonts.bold }]}>
            {trip.restaurant?.name || (trip as any).restaurant_name || 'المطعم'}
          </Text>
          <Text style={[styles.entityAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            {trip.restaurant?.address_text || (trip as any).restaurant_address || 'العنوان محدد في الخريطة'}
          </Text>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={() => handleCall(trip.restaurant?.phone_number || (trip as any).restaurant_phone)}
              style={[styles.smallActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Phone size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary, fontFamily: Fonts.medium }]}>
                اتصال
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const lat = trip.restaurant?.latitude ?? Number((trip as any).restaurant_latitude);
                const lon = trip.restaurant?.longitude ?? Number((trip as any).restaurant_longitude);
                if (lat && lon) {
                  openExternalNavigation(
                    lat,
                    lon,
                    trip.restaurant?.name || (trip as any).restaurant_name || 'المطعم'
                  );
                }
              }}
              style={[styles.smallActionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            >
              <Navigation size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary, fontFamily: Fonts.medium }]}>
                ملاحة
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.secondaryLight }]}>
              <User size={20} color={colors.secondary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              تفاصيل العميل والتسليم
            </Text>
          </View>

          <Text style={[styles.entityName, { color: colors.text, fontFamily: Fonts.bold }]}>
            {trip.customer
              ? `${trip.customer.first_name || ''} ${trip.customer.last_name || ''}`.trim()
              : ((trip as any).customer_name || 'العميل')}
          </Text>
          <Text style={[styles.entityAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            {trip.delivery_address?.street || 'العنوان محدد في الخريطة'}
            {trip.delivery_address?.building_number ? ` - عمارة ${trip.delivery_address.building_number}` : ''}
            {trip.delivery_address?.floor ? ` - طابق ${trip.delivery_address.floor}` : ''}
            {trip.delivery_address?.apartment_number ? ` - شقة ${trip.delivery_address.apartment_number}` : ''}
          </Text>

          {trip.delivery_address?.delivery_instructions ? (
            <View style={[styles.notesBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.notesLabel, { color: colors.secondary, fontFamily: Fonts.medium }]}>
                تعليمات التوصيل:
              </Text>
              <Text style={[styles.notesText, { color: colors.text, fontFamily: Fonts.regular }]}>
                {trip.delivery_address.delivery_instructions}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={() => handleCall(trip.customer?.phone_number || (trip as any).customer_phone)}
              style={[styles.smallActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Phone size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary, fontFamily: Fonts.medium }]}>
                اتصال بالعميل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const lat = trip.delivery_address?.latitude ?? Number((trip as any).delivery_address?.latitude);
                const lon = trip.delivery_address?.longitude ?? Number((trip as any).delivery_address?.longitude);
                if (lat && lon) {
                  openExternalNavigation(
                    lat,
                    lon,
                    trip.customer?.first_name || 'العميل'
                  );
                }
              }}
              style={[styles.smallActionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            >
              <Navigation size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary, fontFamily: Fonts.medium }]}>
                ملاحة
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Items List */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
              <Package size={20} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              محتويات الطلب ({trip.items?.length || 0} صنف)
            </Text>
          </View>

          <View style={styles.itemsList}>
            {(trip.items || []).map((item, idx) => (
              <View key={idx} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.itemPrice, { color: colors.text, fontFamily: Fonts.bold }]}>
                  {item.total_price} ج.م
                </Text>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text, fontFamily: Fonts.medium }]}>
                    {item.quantity}x {item.name}
                  </Text>
                  {item.modifiers && item.modifiers.length > 0 ? (
                    <Text style={[styles.itemModifiers, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                      {item.modifiers.map((m) => m.name).join('، ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Payment Summary */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold, textAlign: 'right' }]}>
            ملخص الدفع والتحصيل
          </Text>

          <View style={styles.paymentRow}>
            <Text style={[styles.paymentValue, { color: colors.text, fontFamily: Fonts.bold }]}>
              {trip.payment_method === 'COD' ? 'دفع عند الاستلام (كاش)' : 'دفع إلكتروني (بطاقة/محفظة)'}
            </Text>
            <Text style={[styles.paymentLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              طريقة الدفع:
            </Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={[styles.paymentValue, { color: colors.text, fontFamily: Fonts.bold }]}>
              {trip.total_amount} ج.م
            </Text>
            <Text style={[styles.paymentLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              إجمالي قيمة الطلب:
            </Text>
          </View>

          {trip.payment_method === 'COD' && (
            <View style={[styles.paymentRow, styles.codHighlight]}>
              <Text style={[styles.paymentValue, { color: colors.danger, fontFamily: Fonts.extraBold }]}>
                {trip.cash_to_collect || trip.total_amount} ج.م
              </Text>
              <Text style={[styles.paymentLabel, { color: colors.danger, fontFamily: Fonts.bold }]}>
                المبلغ المطلوب تحصيله كاش:
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  headerTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: 12,
  },
  orderNumber: {
    fontSize: 18,
  },
  timestampRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 12,
  },
  earningsBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 2,
  },
  earningsLabel: {
    fontSize: 12,
  },
  earningsValueRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 4,
  },
  currency: {
    fontSize: 16,
  },
  earningsValue: {
    fontSize: 28,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
  },
  entityName: {
    fontSize: 16,
    textAlign: 'right',
  },
  entityAddress: {
    fontSize: 13,
    textAlign: 'right',
    marginTop: 2,
  },
  notesBox: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 12,
    textAlign: 'right',
  },
  notesText: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  smallActionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
  },
  smallActionText: {
    fontSize: 13,
  },
  itemsList: {
    marginTop: Spacing.xs,
  },
  itemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemPrice: {
    fontSize: 14,
  },
  itemInfo: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: Spacing.sm,
  },
  itemName: {
    fontSize: 14,
  },
  itemModifiers: {
    fontSize: 11,
    marginTop: 2,
  },
  paymentRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentLabel: {
    fontSize: 13,
  },
  paymentValue: {
    fontSize: 14,
  },
  codHighlight: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  backLink: {
    padding: Spacing.sm,
  },
});
