import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DeliveryTrip, useTripStore } from '../store/tripStore';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { BellRing, Store, MapPin, DollarSign, Clock, X, Check } from 'lucide-react-native';

interface TripOfferModalProps {
  offer: DeliveryTrip | null;
  onAccept: (tripId: string) => Promise<void>;
  onReject: (tripId: string) => Promise<void>;
}

export const TripOfferModal: React.FC<TripOfferModalProps> = ({
  offer,
  onAccept,
  onReject,
}) => {
  const { colors } = useThemeStore();
  const { isActionLoading } = useTripStore();
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (!offer) return;
    setSecondsLeft(30);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject(offer.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [offer?.id]);

  if (!offer) return null;

  return (
    <Modal visible={!!offer} transparent animationType="slide">
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Top Header with Alert and Timer */}
          <View style={styles.header}>
            <View style={[styles.timerBadge, { backgroundColor: colors.primaryLight }]}>
              <Clock size={16} color={colors.primary} />
              <Text style={[styles.timerText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                {secondsLeft} ثانية
              </Text>
            </View>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.extraBold }]}>
                طلب توصيل جديد!
              </Text>
              <View style={[styles.iconPulse, { backgroundColor: colors.primaryLight }]}>
                <BellRing size={20} color={colors.primary} />
              </View>
            </View>
          </View>

          {/* Big Earnings Callout */}
          <View style={[styles.earningsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.earningsLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              أرباحك المتوقعة من هذا الطلب
            </Text>
            <View style={styles.earningsAmountRow}>
              <Text style={[styles.currency, { color: colors.primary, fontFamily: Fonts.bold }]}>ج.م</Text>
              <Text style={[styles.earningsAmount, { color: colors.primary, fontFamily: Fonts.extraBold }]}>
                {offer.driver_earnings}
              </Text>
            </View>
            <Text style={[styles.distanceText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              المسافة المقدرة: {offer.distance_km} كم
            </Text>
          </View>

          {/* Locations */}
          <View style={styles.routeDetails}>
            {/* Store */}
            <View style={styles.routeItem}>
              <View style={[styles.routeIcon, { backgroundColor: colors.primaryLight }]}>
                <Store size={18} color={colors.primary} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={[styles.routeType, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                  استلام من المطعم
                </Text>
                <Text style={[styles.routeName, { color: colors.text, fontFamily: Fonts.bold }]}>
                  {offer.restaurant.name}
                </Text>
                <Text style={[styles.routeAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                  {offer.restaurant.address_text || 'العنوان محدد على الخريطة'}
                </Text>
              </View>
            </View>

            <View style={[styles.dividerVertical, { borderColor: colors.border }]} />

            {/* Customer */}
            <View style={styles.routeItem}>
              <View style={[styles.routeIcon, { backgroundColor: colors.secondaryLight }]}>
                <MapPin size={18} color={colors.secondary} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={[styles.routeType, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                  توصيل إلى العميل
                </Text>
                <Text style={[styles.routeName, { color: colors.text, fontFamily: Fonts.bold }]}>
                  {offer.customer.first_name} {offer.customer.last_name}
                </Text>
                <Text style={[styles.routeAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                  {offer.delivery_address?.street || 'العنوان محدد على الخريطة'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => onReject(offer.id)}
              disabled={isActionLoading}
              activeOpacity={0.8}
              style={[styles.rejectButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <X size={20} color={colors.danger} />
              <Text style={[styles.rejectButtonText, { color: colors.danger, fontFamily: Fonts.bold }]}>
                رفض
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onAccept(offer.id)}
              disabled={isActionLoading}
              activeOpacity={0.8}
              style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            >
              {isActionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={[styles.acceptButtonText, { fontFamily: Fonts.bold }]}>
                    قبول الطلب
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
  },
  iconPulse: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  timerText: {
    fontSize: 13,
  },
  earningsCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  earningsLabel: {
    fontSize: 13,
  },
  earningsAmountRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 4,
  },
  earningsAmount: {
    fontSize: 34,
  },
  currency: {
    fontSize: 18,
  },
  distanceText: {
    fontSize: 13,
  },
  routeDetails: {
    gap: Spacing.sm,
  },
  routeItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  routeType: {
    fontSize: 12,
  },
  routeName: {
    fontSize: 15,
    marginTop: 2,
  },
  routeAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  dividerVertical: {
    height: 16,
    borderRightWidth: 2,
    borderStyle: 'dashed',
    marginRight: 18,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 15,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: 6,
    elevation: 4,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
