import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTripStore } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Star,
  CheckCircle,
  Navigation,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  CreditCard,
  Building,
  Smartphone,
  Receipt,
  Clock,
  Sparkles,
} from 'lucide-react-native';

interface TransactionItem {
  id: string;
  type: 'EARNING' | 'PAYOUT' | 'COD_DEPOSIT';
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  status: 'COMPLETED' | 'PENDING';
}

export default function DriverWalletScreen() {
  const { colors } = useThemeStore();
  const { analytics, fetchAnalytics } = useTripStore();
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payout form
  const [payoutMethod, setPayoutMethod] = useState<'INSTAPAY' | 'VODAFONE_CASH' | 'BANK'>('INSTAPAY');
  const [payoutIdentifier, setPayoutIdentifier] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  // Settlement form
  const [settlementMethod, setSettlementMethod] = useState<'FAWRY' | 'BRANCH' | 'BANK_TRANSFER'>('FAWRY');
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');

  // History Tab Filter
  const [historyTab, setHistoryTab] = useState<'ALL' | 'EARNINGS' | 'PAYOUTS' | 'COD'>('ALL');

  // Local transactions ledger
  const [transactions, setTransactions] = useState<TransactionItem[]>([
    {
      id: 'tx-1',
      type: 'EARNING',
      title: 'أرباح رحلة توصيل #1042',
      subtitle: 'مسافة 4.2 كم - تم إيداعها بالمحفظة',
      amount: 45.0,
      date: 'اليوم، 04:30 م',
      status: 'COMPLETED',
    },
    {
      id: 'tx-2',
      type: 'EARNING',
      title: 'أرباح رحلة توصيل #1038',
      subtitle: 'مسافة 6.1 كم + مكافأة ذروة',
      amount: 62.5,
      date: 'اليوم، 02:15 م',
      status: 'COMPLETED',
    },
    {
      id: 'tx-3',
      type: 'COD_DEPOSIT',
      title: 'توريد كاش عبر فوري',
      subtitle: 'رقم الإيصال: #FW-89104',
      amount: -350.0,
      date: 'أمس، 09:00 م',
      status: 'COMPLETED',
    },
    {
      id: 'tx-4',
      type: 'PAYOUT',
      title: 'سحب أرباح إلى انستاباي',
      subtitle: 'إلى: driver@instapay',
      amount: -250.0,
      date: 'قبل يومين',
      status: 'COMPLETED',
    },
  ]);

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
  const currentEarnings = parseFloat(analytics?.earnings_today || '0');

  // Submit Payout Request
  const handleRequestPayout = () => {
    const amountNum = parseFloat(payoutAmount);
    if (!payoutAmount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح لسحبه');
      return;
    }
    if (amountNum < 50) {
      Alert.alert('تنبيه', 'الحد الأدنى لسحب الأرباح هو 50 ج.م');
      return;
    }
    if (!payoutIdentifier.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال تفاصيل حساب التحويل (رقم المحفظة أو عنوان InstaPay)');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowPayoutModal(false);

      const newTx: TransactionItem = {
        id: `tx-payout-${Date.now()}`,
        type: 'PAYOUT',
        title: `طلب سحب أرباح (${payoutMethod === 'INSTAPAY' ? 'انستاباي' : payoutMethod === 'VODAFONE_CASH' ? 'فودافون كاش' : 'تحويل بنكي'})`,
        subtitle: `إلى: ${payoutIdentifier}`,
        amount: -amountNum,
        date: 'الآن',
        status: 'PENDING',
      };
      setTransactions((prev) => [newTx, ...prev]);
      setPayoutAmount('');
      setPayoutIdentifier('');

      Alert.alert('تم بنجاح 🎉', `تم رفع طلب سحب مبلغ ${amountNum} ج.م بنجاح، وسيتم إيداعها بحسابك خلال ساعتين.`);
    }, 700);
  };

  // Submit COD Settlement
  const handleSettleCOD = () => {
    const amountNum = parseFloat(settlementAmount || String(cashInHand));
    if (!amountNum || amountNum <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ التوريد');
      return;
    }
    if (!settlementReference.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم إيصال الدفع أو المرجع البنكي');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSettlementModal(false);

      const newTx: TransactionItem = {
        id: `tx-settle-${Date.now()}`,
        type: 'COD_DEPOSIT',
        title: `توريد عهدة نقدية (${settlementMethod === 'FAWRY' ? 'فوري' : settlementMethod === 'BRANCH' ? 'مقر الشركة' : 'تحويل بنكي'})`,
        subtitle: `رقم المرجع: #${settlementReference}`,
        amount: -amountNum,
        date: 'الآن',
        status: 'PENDING',
      };
      setTransactions((prev) => [newTx, ...prev]);
      setSettlementReference('');
      setSettlementAmount('');

      Alert.alert('تم استلام إيصال التوريد 🧾', `جاري مراجعة إيصال التوريد لمبلغ ${amountNum} ج.م وسيتم تصفية العهدة فوراً.`);
    }, 700);
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (historyTab === 'ALL') return true;
    if (historyTab === 'EARNINGS') return tx.type === 'EARNING';
    if (historyTab === 'PAYOUTS') return tx.type === 'PAYOUT';
    if (historyTab === 'COD') return tx.type === 'COD_DEPOSIT';
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          المحفظة والأرباح 💰
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Earnings Hero Banner */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.heroLabel, { fontFamily: Fonts.medium }]}>
            أرباح اليوم المكتسبة
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

        {/* Action Buttons: Payout & COD Settlement */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={() => setShowPayoutModal(true)}
            activeOpacity={0.8}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <ArrowUpRight size={20} color="#FFFFFF" />
            <Text style={[styles.actionBtnText, { fontFamily: Fonts.bold }]}>
              سحب الأرباح 💳
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSettlementAmount(String(cashInHand));
              setShowSettlementModal(true);
            }}
            activeOpacity={0.8}
            style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
          >
            <ArrowDownLeft size={20} color="#FFFFFF" />
            <Text style={[styles.actionBtnText, { fontFamily: Fonts.bold }]}>
              توريد الكاش 💵
            </Text>
          </TouchableOpacity>
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
                اقتربت من الحد الأقصى للنقدية. يرجى توريد الكاش للفرع أو عبر فوري لمتابعة استقبال طلبات الدفع عند الاستلام.
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

        {/* Transaction History Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: Spacing.xs }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: colors.primaryLight }]}>
              <Receipt size={20} color={colors.primary} />
            </View>
            <View style={styles.cardTitleText}>
              <Text style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                سجل المعاملات والحركات المالية
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                تفاصيل الأرباح، السحوبات، وتوريد العهد
              </Text>
            </View>
          </View>

          {/* History Filter Tabs */}
          <View style={styles.filterTabsRow}>
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'EARNINGS', label: 'الأرباح' },
                { id: 'PAYOUTS', label: 'المسحوبات' },
                { id: 'COD', label: 'توريد كاش' },
              ] as const
            ).map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setHistoryTab(tab.id)}
                style={[
                  styles.filterTabPill,
                  historyTab === tab.id
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    {
                      color: historyTab === tab.id ? '#FFFFFF' : colors.textSecondary,
                      fontFamily: historyTab === tab.id ? Fonts.bold : Fonts.medium,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Transactions List */}
          <View style={styles.transactionsList}>
            {filteredTransactions.map((tx) => (
              <View
                key={tx.id}
                style={[styles.transactionRow, { borderBottomColor: colors.border }]}
              >
                <View
                  style={[
                    styles.txIconBox,
                    {
                      backgroundColor:
                        tx.type === 'EARNING'
                          ? colors.successLight
                          : tx.type === 'PAYOUT'
                          ? colors.primaryLight
                          : colors.secondaryLight,
                    },
                  ]}
                >
                  {tx.type === 'EARNING' ? (
                    <TrendingUp size={18} color={colors.success} />
                  ) : tx.type === 'PAYOUT' ? (
                    <ArrowUpRight size={18} color={colors.primary} />
                  ) : (
                    <ArrowDownLeft size={18} color={colors.secondary} />
                  )}
                </View>

                <View style={styles.txInfo}>
                  <Text style={[styles.txTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                    {tx.title}
                  </Text>
                  <Text style={[styles.txSub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                    {tx.subtitle} • {tx.date}
                  </Text>
                </View>

                <View style={styles.txAmountCol}>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color: tx.amount > 0 ? colors.success : colors.text,
                        fontFamily: Fonts.extraBold,
                      },
                    ]}
                  >
                    {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} ج.م
                  </Text>
                  <View
                    style={[
                      styles.txStatusPill,
                      {
                        backgroundColor:
                          tx.status === 'COMPLETED' ? colors.successLight : colors.warningLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.txStatusText,
                        {
                          color: tx.status === 'COMPLETED' ? colors.success : colors.warning,
                          fontFamily: Fonts.medium,
                        },
                      ]}
                    >
                      {tx.status === 'COMPLETED' ? 'مكتمل' : 'قيد المعالجة'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Payout Modal */}
      <Modal
        visible={showPayoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowPayoutModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                طلب سحب أرباحك 💳
              </Text>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              اختر طريقة السحب المفضلة وأدخل المبلغ المطلوب (الحد الأدنى 50 ج.م):
            </Text>

            {/* Method Selector */}
            <View style={styles.methodSelectorRow}>
              {[
                { id: 'INSTAPAY', label: 'انستاباي', icon: Sparkles },
                { id: 'VODAFONE_CASH', label: 'فودافون كاش', icon: Smartphone },
                { id: 'BANK', label: 'تحويل بنكي', icon: Building },
              ].map((m) => {
                const IconComponent = m.icon;
                const isSelected = payoutMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setPayoutMethod(m.id as any)}
                    style={[
                      styles.methodOption,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <IconComponent size={20} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.methodLabel,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontFamily: isSelected ? Fonts.bold : Fonts.medium,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Identifier input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                {payoutMethod === 'INSTAPAY'
                  ? 'عنوان الدفع اللحظي (IPA) أو رقم الهاتف:'
                  : payoutMethod === 'VODAFONE_CASH'
                  ? 'رقم محفظة فودافون كاش:'
                  : 'رقم الآيبان البنكي (IBAN):'}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
                placeholder={
                  payoutMethod === 'INSTAPAY'
                    ? 'user@instapay أو 01012345678'
                    : payoutMethod === 'VODAFONE_CASH'
                    ? '010XXXXXXXX'
                    : 'EG0000000000000000000000000'
                }
                placeholderTextColor={colors.textMuted}
                value={payoutIdentifier}
                onChangeText={setPayoutIdentifier}
                textAlign="right"
              />
            </View>

            {/* Amount input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                المبلغ المراد سحبه (ج.م):
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.extraBold,
                    fontSize: 18,
                  },
                ]}
                placeholder="100"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                textAlign="center"
              />
            </View>

            {/* Submit Payout Button */}
            <TouchableOpacity
              onPress={handleRequestPayout}
              disabled={isSubmitting}
              style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.modalSubmitBtnText, { fontFamily: Fonts.bold }]}>
                  تأكيد وإرسال طلب السحب 🚀
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COD Settlement Modal */}
      <Modal
        visible={showSettlementModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettlementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowSettlementModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                تسوية وتوريد الكاش 💵
              </Text>
            </View>

            {/* Current COD Banner */}
            <View style={[styles.settleBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Text style={[styles.settleBannerTitle, { color: colors.warning, fontFamily: Fonts.bold }]}>
                إجمالي العهدة النقدية الحالية
              </Text>
              <Text style={[styles.settleBannerAmount, { color: colors.text, fontFamily: Fonts.extraBold }]}>
                {cashInHand.toFixed(2)} ج.م
              </Text>
            </View>

            {/* Settlement Instructions */}
            <View style={styles.methodSelectorRow}>
              {[
                { id: 'FAWRY', label: 'كود فوري', icon: Smartphone },
                { id: 'BRANCH', label: 'مقر الفرع', icon: Building },
                { id: 'BANK_TRANSFER', label: 'حساب بنكي', icon: CreditCard },
              ].map((m) => {
                const IconComponent = m.icon;
                const isSelected = settlementMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setSettlementMethod(m.id as any)}
                    style={[
                      styles.methodOption,
                      {
                        backgroundColor: isSelected ? colors.secondaryLight : colors.surface,
                        borderColor: isSelected ? colors.secondary : colors.border,
                      },
                    ]}
                  >
                    <IconComponent size={20} color={isSelected ? colors.secondary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.methodLabel,
                        {
                          color: isSelected ? colors.secondary : colors.text,
                          fontFamily: isSelected ? Fonts.bold : Fonts.medium,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.guideBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.guideText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                {settlementMethod === 'FAWRY'
                  ? 'كود خدمة فوري لتوريد مناديب فوكس شوب: 71982. احتفظ بإيصال فوري وأدخل رقمه المرجعي بالأسفل.'
                  : settlementMethod === 'BRANCH'
                  ? 'يرجى التوجه إلى مقر الإدارة الرئيسي أو أقرب فرع تشغيلي وتسليم المبلغ لمسؤول الخزينة مع استلام وصل استلام.'
                  : 'رقم حساب شركة فوكس شوب (CIB): EG1200000001000987654321. حوّل المبلغ وأدخل رقم العملية.'}
              </Text>
            </View>

            {/* Reference Number input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                رقم إيصال السداد / المرجع:
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
                placeholder="مثال: FW-9821345"
                placeholderTextColor={colors.textMuted}
                value={settlementReference}
                onChangeText={setSettlementReference}
                textAlign="right"
              />
            </View>

            {/* Submit Settlement Button */}
            <TouchableOpacity
              onPress={handleSettleCOD}
              disabled={isSubmitting}
              style={[styles.modalSubmitBtn, { backgroundColor: colors.secondary }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.modalSubmitBtnText, { fontFamily: Fonts.bold }]}>
                  تأكيد توريد العهدة 🧾
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: Spacing.xxl + 20,
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
  actionButtonsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  filterTabsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.xs,
    marginTop: 2,
  },
  filterTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  filterTabLabel: {
    fontSize: 12,
  },
  transactionsList: {
    marginTop: Spacing.xs,
  },
  transactionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  txTitle: {
    fontSize: 13,
  },
  txSub: {
    fontSize: 11,
  },
  txAmountCol: {
    alignItems: 'flex-start',
    gap: 2,
  },
  txAmount: {
    fontSize: 14,
  },
  txStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  txStatusText: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  methodSelectorRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  methodOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    gap: 6,
  },
  methodLabel: {
    fontSize: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    textAlign: 'right',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 14,
  },
  modalSubmitBtn: {
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  settleBanner: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  settleBannerTitle: {
    fontSize: 13,
  },
  settleBannerAmount: {
    fontSize: 22,
  },
  guideBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  guideText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
});
