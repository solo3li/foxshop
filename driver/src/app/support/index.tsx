import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSupportStore, SupportTicket } from '../../store/supportStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import {
  Headphones,
  Plus,
  ChevronLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  Wrench,
  Package,
  MapPin,
  Banknote,
  HelpCircle,
} from 'lucide-react-native';

const CATEGORIES = [
  { id: 'DRIVER_ISSUE', label: 'عطل في المركبة أو حادث لا قدر الله', icon: Wrench },
  { id: 'ORDER_ISSUE', label: 'مشكلة في أصناف أو استلام الطلب', icon: Package },
  { id: 'DELIVERY_DELAY', label: 'مشكلة في موقع أو عنوان العميل', icon: MapPin },
  { id: 'PAYMENT_DISPUTE', label: 'نزاع مالي أو تحصيل الكاش', icon: Banknote },
  { id: 'OTHER', label: 'استفسار أو مشكلة أخرى', icon: HelpCircle },
];

export default function SupportHubScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { tickets, isLoading, isSending, fetchTickets, createTicket } = useSupportStore();

  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('DRIVER_ISSUE');
  const [initialMessage, setInitialMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async () => {
    if (!subject.trim()) {
      setErrorMsg('الرجاء كتابة عنوان أو موضوع التذكرة');
      return;
    }

    setErrorMsg(null);
    const newTicket = await createTicket({
      subject: subject.trim(),
      category,
      initial_message: initialMessage.trim() || undefined,
    });

    if (newTicket) {
      setIsModalOpen(false);
      setSubject('');
      setInitialMessage('');
      router.push(`/support/${newTicket.id}` as any);
    } else {
      setErrorMsg('تعذر إنشاء التذكرة، يرجى المحاولة لاحقاً');
    }
  };

  const getStatusBadge = (status: SupportTicket['status']) => {
    switch (status) {
      case 'OPEN':
        return { label: 'مفتوحة (جديدة)', bg: colors.warningLight, text: colors.warning };
      case 'IN_PROGRESS':
        return { label: 'قيد المعالجة 💬', bg: colors.primaryLight, text: colors.primary };
      case 'WAITING_USER':
        return { label: 'بانتظار ردك', bg: colors.secondaryLight, text: colors.secondary };
      case 'RESOLVED':
        return { label: 'تم الحل ✅', bg: colors.successLight, text: colors.success };
      case 'CLOSED':
        return { label: 'مغلقة', bg: colors.surface, text: colors.textSecondary };
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === 'ACTIVE') {
      return t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_USER';
    }
    if (activeTab === 'CLOSED') {
      return t.status === 'RESOLVED' || t.status === 'CLOSED';
    }
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <ArrowRight size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            مركز الدعم والمساعدة
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setIsModalOpen(true)}
          style={[styles.createHeaderBtn, { backgroundColor: colors.primary }]}
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={[styles.createHeaderBtnText, { fontFamily: Fonts.bold }]}>
            تذكرة جديدة
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('ACTIVE')}
          style={[
            styles.tabItem,
            activeTab === 'ACTIVE' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'ACTIVE' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'ACTIVE' ? Fonts.bold : Fonts.medium,
              },
            ]}
          >
            النشطة والمفتوحة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('CLOSED')}
          style={[
            styles.tabItem,
            activeTab === 'CLOSED' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'CLOSED' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'CLOSED' ? Fonts.bold : Fonts.medium,
              },
            ]}
          >
            المغلقة والسابقة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('ALL')}
          style={[
            styles.tabItem,
            activeTab === 'ALL' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'ALL' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'ALL' ? Fonts.bold : Fonts.medium,
              },
            ]}
          >
            الكل ({tickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tickets List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTickets} />}
      >
        {filteredTickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryLight }]}>
              <Headphones size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              لا توجد تذاكر في هذا القسم
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              إذا واجهتك أي مشكلة أثناء عملك، يمكنك فتح تذكرة دعم فني جديدة وسيقوم فريق الدعم بمساعدتك فوراً.
            </Text>
            <TouchableOpacity
              onPress={() => setIsModalOpen(true)}
              style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[styles.emptyActionBtnText, { fontFamily: Fonts.bold }]}>
                فتح تذكرة دعم جديدة
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTickets.map((t) => {
            const badge = getStatusBadge(t.status);
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/support/${t.id}` as any)}
                style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.ticketTopRow}>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text, fontFamily: Fonts.bold }]}>
                      {badge.label}
                    </Text>
                  </View>
                  <Text style={[styles.ticketNumber, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                    #{t.ticket_number}
                  </Text>
                </View>

                <Text style={[styles.ticketSubject, { color: colors.text, fontFamily: Fonts.bold }]}>
                  {t.subject}
                </Text>

                <View style={styles.ticketMetaRow}>
                  <View style={[styles.categoryPill, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.categoryText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                      {t.category_display || t.category}
                    </Text>
                  </View>

                  <View style={styles.dateRow}>
                    <Clock size={13} color={colors.textMuted} />
                    <Text style={[styles.dateText, { color: colors.textMuted, fontFamily: Fonts.regular }]}>
                      {new Date(t.created_at).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                <View style={styles.ticketFooter}>
                  <Text style={[styles.enterChatText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                    دخول المحادثة 💬
                  </Text>
                  <ChevronLeft size={18} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* New Ticket Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={[styles.closeModalBtn, { backgroundColor: colors.surface }]}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                فتح تذكرة دعم جديدة
              </Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {errorMsg && (
                <View style={[styles.errorBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                  <AlertCircle size={18} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                    {errorMsg}
                  </Text>
                </View>
              )}

              {/* Category Selector */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                نوع المشكلة أو الاستفسار:
              </Text>
              <View style={styles.categoriesList}>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategory(cat.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.categoryOption,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Icon size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          {
                            color: isSelected ? colors.primary : colors.text,
                            fontFamily: isSelected ? Fonts.bold : Fonts.regular,
                          },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subject */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                عنوان التذكرة:
              </Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="مثال: عطل في الإطار أثناء التوصيل"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.medium,
                  },
                ]}
              />

              {/* Initial message */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                تفاصيل إضافية (اختياري):
              </Text>
              <TextInput
                value={initialMessage}
                onChangeText={setInitialMessage}
                placeholder="اكتب ما حدث معك بالتفصيل..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.regular,
                  },
                ]}
              />

              <TouchableOpacity
                onPress={handleCreateTicket}
                disabled={isSending}
                style={[styles.submitTicketBtn, { backgroundColor: colors.primary }]}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MessageSquare size={18} color="#FFFFFF" />
                    <Text style={[styles.submitTicketBtnText, { fontFamily: Fonts.bold }]}>
                      بدء المحادثة مع الدعم 🚀
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
  },
  createHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    gap: 4,
  },
  createHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {},
  tabText: {
    fontSize: 13,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  emptyActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.xl,
    gap: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  ticketCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  ticketTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: 11,
  },
  ticketNumber: {
    fontSize: 12,
  },
  ticketSubject: {
    fontSize: 15,
    textAlign: 'right',
  },
  ticketMetaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  categoryText: {
    fontSize: 11,
  },
  dateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
  },
  ticketFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enterChatText: {
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  formLabel: {
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'right',
  },
  categoriesList: {
    gap: 6,
    marginBottom: Spacing.md,
  },
  categoryOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  categoryOptionText: {
    fontSize: 13,
  },
  textInput: {
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    textAlign: 'right',
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 80,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    textAlign: 'right',
    textAlignVertical: 'top',
    fontSize: 13,
    marginBottom: Spacing.lg,
  },
  submitTicketBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: Radius.xl,
    gap: 8,
    marginBottom: Spacing.xl,
  },
  submitTicketBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
