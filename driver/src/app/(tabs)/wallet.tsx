import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTripStore } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Wallet, DollarSign, TrendingUp, AlertTriangle, Star, CheckCircle, Navigation, Award } from 'lucide-react-native';

export default function DriverWalletScreen() {
  const { colors } = useThemeStore();
  const { analytics, fetchAnalytics } = useTripStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const cashInHand = parseFloat(analytics?.cash_in_hand || '0');
  const codCeiling = parseFloat(analytics?.cod_max_ceiling || '500');
  const ceilingPercent = Math.min(Math.round((cashInHand / (codCeiling || 1)) * 100), 100);
  const isCeilingWarning = ceilingPercent >= 80;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          المحفظة والأرباح
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Earnings Hero Banner */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.heroLabel, { fontFamily: Fonts.medium }]}>
            أرباح اليوم
          </Text>
          <View style={styles.heroAmountRow}>
            <Text style={[styles.heroCurrency, { fontFamily: Fonts.bold }]}>ج.م</Text>
            <Text style={[styles.heroAmount, { fontFamily: Fonts.extraBold }]}>
              {analytics?.earnings_today || '0.00'}
            </Text>
          </View>
          <Text style={[styles.heroSub, { fontFamily: Fonts.regular }]}>
            تم إنجاز {analytics?.trips_today_count || 0} طلبات توصيل اليوم
          </Text>

          {/* Quick breakdown row */}
          <View style={styles.heroBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { fontFamily: Fonts.regular }]}>أرباح الأسبوع</Text>
              <Text style={[styles.breakdownVal, { fontFamily: Fonts.bold }]}>
                {analytics?.earnings_week || '0'} ج.م
              </Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownLabel, { fontFamily: Fonts.regular }]}>أرباح الشهر</Text>
              <Text style={[styles.breakdownVal, { fontFamily: Fonts.bold }]}>
                {analytics?.earnings_month || '0'} ج.م
              </Text>
            </View>
          </View>
        </View>

        {/* COD Cash in Hand & Ceiling Meter */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: colors.warningLight }]}>
              <DollarSign size={20} color={colors.warning} />
            </View>
            <View style={styles.cardTitleText}>
              <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                النقدية في عهدتك (COD)
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                الحد الأقصى المسموح به: {codCeiling} ج.م
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.meterContainer}>
            <View style={styles.meterLabels}>
              <Text style={[styles.meterValue, { color: colors.text, fontFamily: Fonts.bold }]}>
                {cashInHand.toFixed(2)} ج.م
              </Text>
              <Text style={[styles.meterPercent, { color: isCeilingWarning ? colors.danger : colors.primary, fontFamily: Fonts.bold }]}>
                {ceilingPercent}% من الحد
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${ceilingPercent}%`,
                    backgroundColor: isCeilingWarning ? colors.danger : colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          {isCeilingWarning && (
            <View style={[styles.warningBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
              <AlertTriangle size={18} color={colors.danger} />
              <Text style={[styles.warningText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                اقتربت من الحد الأقصى للنقدية. يرجى توريد الكاش للفرع أو عبر المحفظة لمتابعة استقبال طلبات الدفع عند الاستلام.
              </Text>
            </View>
          )}
        </View>

        {/* Performance Metrics */}
        <View style={styles.metricsGrid}>
          {/* Total Delivered */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.successLight }]}>
              <CheckCircle size={22} color={colors.success} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.extraBold }]}>
              {analytics?.total_delivered || 0}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              طلبات مكتملة
            </Text>
          </View>

          {/* Rating */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.warningLight }]}>
              <Star size={22} color={colors.warning} fill={colors.warning} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.extraBold }]}>
              {analytics?.rating ? Number(analytics.rating).toFixed(1) : '5.0'}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              تقييم الكابتن
            </Text>
          </View>

          {/* Total Distance */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.primaryLight }]}>
              <Navigation size={22} color={colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.extraBold }]}>
              {analytics?.total_distance_km || 0}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              إجمالي الكيلومترات
            </Text>
          </View>

          {/* Trips This Week */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIconBox, { backgroundColor: colors.secondaryLight }]}>
              <TrendingUp size={22} color={colors.secondary} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text, fontFamily: Fonts.extraBold }]}>
              {analytics?.trips_week_count || 0}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              رحلات هذا الأسبوع
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 4,
  },
  heroLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  heroAmountRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 4,
  },
  heroCurrency: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  heroSub: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.85,
    marginTop: 2,
  },
  heroBreakdown: {
    flexDirection: 'row-reverse',
    width: '100%',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
  },
  breakdownVal: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 2,
  },
  dividerVertical: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontSize: 15,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  meterContainer: {
    gap: 6,
  },
  meterLabels: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  meterValue: {
    fontSize: 16,
  },
  meterPercent: {
    fontSize: 13,
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: Radius.full,
  },
  warningBox: {
    flexDirection: 'row-reverse',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metricCard: {
    width: '47.5%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  metricIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
  },
  metricLabel: {
    fontSize: 12,
  },
});
