import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform, Vibration } from 'react-native';
import { DeliveryTrip, useTripStore } from '../store/tripStore';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { BellRing, Store, MapPin, DollarSign, Clock, X, Check, Volume2 } from 'lucide-react-native';

interface TripOfferModalProps {
  offer: DeliveryTrip | null;
  onAccept: (tripId: string) => Promise<void>;
  onReject: (tripId: string) => Promise<void>;
}

function playDispatchRingtone() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return () => {};
      const ctx = new AudioCtx();
      let active = true;

      const playBeep = () => {
        if (!active || ctx.state === 'closed') return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
          osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2); // E5 note
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } catch {}
      };

      playBeep();
      const interval = setInterval(playBeep, 800);
      return () => {
        active = false;
        clearInterval(interval);
        ctx.close().catch(() => {});
      };
    } catch {
      return () => {};
    }
  } else {
    try {
      Vibration.vibrate([0, 500, 200, 500]);
    } catch {}
    return () => {};
  }
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

    const stopAudio = playDispatchRingtone();

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopAudio();
          onReject(offer.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      stopAudio();
    };
  }, [offer?.id]);

  if (!offer) return null;

  const isUrgent = secondsLeft <= 10;
  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));

  return (
    <Modal visible={!!offer} transparent animationType="slide">
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          
          {/* Visual Expiry Progress Bar */}
          <View style={[styles.timerProgressTrack, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.timerProgressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isUrgent ? colors.danger : colors.primary,
                },
              ]}
            />
          </View>

          {/* Top Header with Alert and Timer */}
          <View style={styles.header}>
            <View
              style={[
                styles.timerBadge,
                { backgroundColor: isUrgent ? colors.dangerLight : colors.primaryLight },
              ]}
            >
              <Clock size={16} color={isUrgent ? colors.danger : colors.primary} />
              <Text
                style={[
                  styles.timerText,
                  { color: isUrgent ? colors.danger : colors.primary, fontFamily: Fonts.bold },
                ]}
              >
                متبقي {secondsLeft} ثانية
              </Text>
            </View>

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.extraBold }]}>
                طلب توصيل جديد!
              </Text>
              <View
                style={[
                  styles.iconPulse,
                  { backgroundColor: isUrgent ? colors.dangerLight : colors.primaryLight },
                ]}
              >
                <BellRing size={20} color={isUrgent ? colors.danger : colors.primary} />
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
                  {offer.restaurant?.name || (offer as any).restaurant_name || 'المطعم'}
                </Text>
                <Text style={[styles.routeAddress, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                  {offer.restaurant?.address_text || (offer as any).restaurant_address || 'العنوان محدد على الخريطة'}
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
                  {offer.customer
                    ? `${offer.customer.first_name || ''} ${offer.customer.last_name || ''}`.trim()
                    : ((offer as any).customer_name || 'العميل')}
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
  timerProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 4,
  },
  timerProgressBar: {
    height: '100%',
    borderRadius: 2,
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
  currency: {
    fontSize: 16,
  },
  earningsAmount: {
    fontSize: 32,
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
    gap: Spacing.sm,
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
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
  },
  routeAddress: {
    fontSize: 13,
    textAlign: 'right',
  },
  dividerVertical: {
    height: 12,
    borderRightWidth: 2,
    borderStyle: 'dashed',
    marginRight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 16,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: Radius.lg,
    gap: 6,
    elevation: 4,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
