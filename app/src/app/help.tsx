import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  X,
  Headphones,
  FileText,
  Lock,
  LogIn,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import {
  supportService,
  SupportTicketItem,
  SupportMessage,
} from '../services/supportService';

const FAQS = [
  {
    q: 'كيف يمكنني تتبع طلبي المباشر ومعرفة موقع الكابتن؟',
    a: 'بمجرد تأكيد طلبك وقبوله من المطعم والكابتن، يمكنك الضغط على قسم "الطلبات" في حسابك أو متابعة خريطة التتبع المباشرة التي تظهر موقع الكابتن بالوقت الفعلي حتى باب منزلك.',
  },
  {
    q: 'ما هي طرق الدفع المتاحة في تطبيق فوكس شوب؟',
    a: 'نوفر الدفع نقداً عند الاستلام (COD)، بالإضافة إلى بطاقات مدى، فيزا، ماستركارد، وأبل باي للدفع الإلكتروني الآمن والسريع.',
  },
  {
    q: 'كيف أقوم بإلغاء طلبي أو تعديل محتوياته؟',
    a: 'يمكنك إلغاء الطلب خلال أول دقيقة من إرساله قبل بدء المطعم في تحضيره عبر شاشة الطلبات، أو فتح تذكرة دعم فورية مع فريق خدمة العملاء إذا تجاوز الطلب هذه المدة.',
  },
  {
    q: 'متى يتم استرداد المبلغ بعد إلغاء الطلب؟',
    a: 'في حال الدفع الإلكتروني، يتم إرجاع المبلغ تلقائياً لمحفظتك فوراً، أو لحسابك البنكي خلال ٣ إلى ٥ أيام عمل حسب سياسة البنك المصدر لبطاقتك.',
  },
  {
    q: 'كيف أستخدم كوبونات وقسائم الخصم في الطلب؟',
    a: 'تفضل بزيارة صفحة "القسائم والعروض" لنسخ أي كوبون ترغب به، ثم توجه إلى سلة المشتريات وأدخل الكود في خانة "كود الخصم" قبل إتمام الدفع ليتم تطبيق الخصم فورياً.',
  },
  {
    q: 'ماذا أفعل في حال وصول وجبة ناقصة أو غير مطابقة؟',
    a: 'نعتذر بشدة عن ذلك! يرجى فتح تذكرة دعم فني جديدة عبر هذه الصفحة واختيار تصنيف "مشكلة في الطلب"، وسيقوم فريق الدعم فوراً بتعويضك أو إعادة إرسال الأصناف الناقصة.',
  },
];

const CATEGORIES = [
  { id: 'ORDER_ISSUE', label: 'مشكلة في الطلب' },
  { id: 'DELIVERY_DELAY', label: 'تأخر التوصيل' },
  { id: 'FOOD_QUALITY', label: 'جودة الطعام أو تلفه' },
  { id: 'PAYMENT_DISPUTE', label: 'نزاع مالي أو استرداد' },
  { id: 'OTHER', label: 'استفسار آخر' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'tickets' | 'faqs'>('tickets');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Tickets
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, SupportMessage[]>>({});
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Modal
  const [showModal, setShowModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('ORDER_ISSUE');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingTickets(true);
    try {
      const res = await supportService.getTickets();
      if (res.data) {
        setTickets(res.data);
      }
    } catch (err) {
      console.warn('Error fetching support tickets:', err);
    } finally {
      setLoadingTickets(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    }
  }, [isAuthenticated, fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleOpenContact = (type: 'whatsapp' | 'phone' | 'email') => {
    switch (type) {
      case 'whatsapp':
        Linking.openURL('https://wa.me/966500000000');
        break;
      case 'phone':
        Linking.openURL('tel:920000000');
        break;
      case 'email':
        Linking.openURL('mailto:support@foxshop.com?subject=FoxShop%20Support');
        break;
    }
  };

  const handleToggleTicketDetails = async (ticketId: string) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }

    setExpandedTicketId(ticketId);
    if (!ticketMessages[ticketId]) {
      try {
        const res = await supportService.getTicketDetail(ticketId);
        if (res.data && res.data.messages) {
          setTicketMessages((prev) => ({
            ...prev,
            [ticketId]: res.data?.messages || [],
          }));
        }
      } catch (err) {
        console.warn('Error fetching ticket detail:', err);
      }
    }
  };

  const handleSendReply = async (ticketId: string) => {
    const text = replyText.trim();
    if (!text) return;

    setSendingReply(true);
    try {
      const res = await supportService.addMessage(ticketId, text);
      if (res.data) {
        setTicketMessages((prev) => ({
          ...prev,
          [ticketId]: [...(prev[ticketId] || []), res.data as SupportMessage],
        }));
        setReplyText('');
      }
    } catch (err) {
      console.warn('Error sending reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      if (Platform.OS === 'web') {
        window.alert('يرجى ملء كافة حقول التذكرة');
      } else {
        Alert.alert('تنبيه', 'يرجى ملء كافة حقول التذكرة');
      }
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await supportService.createTicket({
        subject: newSubject.trim(),
        category: newCategory,
        initial_message: newMessage.trim(),
      });

      if (res.data) {
        setTickets((prev) => [res.data as SupportTicketItem, ...prev]);
        setShowModal(false);
        setNewSubject('');
        setNewMessage('');
      } else {
        const errMsg = res.error || 'فشل في إنشاء التذكرة';
        if (Platform.OS === 'web') window.alert(errMsg);
        else Alert.alert('خطأ', errMsg);
      }
    } catch {
      if (Platform.OS === 'web') window.alert('حدث خطأ أثناء إرسال التذكرة');
      else Alert.alert('خطأ', 'حدث خطأ أثناء إرسال التذكرة');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const getStatusBadge = (status: string, statusDisplay: string) => {
    switch (status) {
      case 'OPEN':
        return { bg: '#DBEAFE', text: '#1E40AF', label: statusDisplay || 'مفتوحة' };
      case 'IN_PROGRESS':
        return { bg: '#FEF3C7', text: '#92400E', label: statusDisplay || 'قيد المعالجة' };
      case 'WAITING_USER':
        return { bg: '#FCE7F3', text: '#9D174D', label: statusDisplay || 'بانتظار ردك' };
      case 'RESOLVED':
        return { bg: '#D1FAE5', text: '#065F46', label: statusDisplay || 'تم الحل' };
      case 'CLOSED':
        return { bg: '#F3F4F6', text: '#4B5563', label: statusDisplay || 'مغلقة' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563', label: statusDisplay };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>مركز المساعدة والدعم</Text>
          <Text style={styles.headerSubtitle}>نحن هنا لمساعدتك على مدار الساعة 🦊</Text>
        </View>
        <View style={styles.headerIconCircle}>
          <Headphones size={20} color={Colors.light.primary} />
        </View>
      </View>

      {/* Quick Action Contact Channels */}
      <View style={styles.channelsContainer}>
        <TouchableOpacity
          style={styles.channelCard}
          onPress={() => handleOpenContact('whatsapp')}
          activeOpacity={0.8}
        >
          <View style={[styles.channelIcon, { backgroundColor: '#DCFCE7' }]}>
            <MessageSquare size={20} color="#16A34A" />
          </View>
          <Text style={styles.channelText}>واتساب</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.channelCard}
          onPress={() => handleOpenContact('phone')}
          activeOpacity={0.8}
        >
          <View style={[styles.channelIcon, { backgroundColor: '#DBEAFE' }]}>
            <Phone size={20} color="#2563EB" />
          </View>
          <Text style={styles.channelText}>اتصال مباشر</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.channelCard}
          onPress={() => handleOpenContact('email')}
          activeOpacity={0.8}
        >
          <View style={[styles.channelIcon, { backgroundColor: '#FEE2E2' }]}>
            <Mail size={20} color="#DC2626" />
          </View>
          <Text style={styles.channelText}>البريد</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.channelCard}
          onPress={() => {
            if (!isAuthenticated) router.push('/auth/login');
            else setShowModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.channelIcon, { backgroundColor: Colors.light.primaryLight }]}>
            <PlusCircle size={20} color={Colors.light.primary} />
          </View>
          <Text style={styles.channelText}>تذكرة جديدة</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tickets' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tickets')}
          activeOpacity={0.8}
        >
          <FileText
            size={16}
            color={activeTab === 'tickets' ? '#FFFFFF' : '#6B7280'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'tickets' && styles.tabButtonTextActive]}
          >
            تذاكر الدعم ({tickets.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'faqs' && styles.tabButtonActive]}
          onPress={() => setActiveTab('faqs')}
          activeOpacity={0.8}
        >
          <HelpCircle
            size={16}
            color={activeTab === 'faqs' ? '#FFFFFF' : '#6B7280'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'faqs' && styles.tabButtonTextActive]}
          >
            الأسئلة الشائعة
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
      >
        {/* TAB 1: SUPPORT TICKETS */}
        {activeTab === 'tickets' && (
          <>
            {!isAuthenticated ? (
              <View style={styles.authPromptCard}>
                <View style={styles.authPromptIconCircle}>
                  <Lock size={36} color={Colors.light.primary} />
                </View>
                <Text style={styles.authPromptTitle}>تسجيل الدخول مطلوب</Text>
                <Text style={styles.authPromptSubtitle}>
                  سجل دخولك الآن لمتابعة تذاكر الشكاوى والدعم وفتح تذاكر جديدة لمتابعة طلباتك.
                </Text>
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => router.push('/auth/login')}
                  activeOpacity={0.8}
                >
                  <LogIn size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.ticketActionsRow}>
                  <Text style={styles.ticketsSectionHeading}>سجل تذاكر الشكاوى والاستفسارات</Text>
                  <TouchableOpacity
                    style={styles.newTicketInlineBtn}
                    onPress={() => setShowModal(true)}
                    activeOpacity={0.8}
                  >
                    <PlusCircle size={16} color="#FFFFFF" />
                    <Text style={styles.newTicketInlineText}>تذكرة جديدة</Text>
                  </TouchableOpacity>
                </View>

                {loadingTickets && (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>جاري تحميل التذاكر...</Text>
                  </View>
                )}

                {!loadingTickets && tickets.length === 0 && (
                  <View style={styles.emptyTicketsBox}>
                    <CheckCircle size={48} color="#10B981" />
                    <Text style={styles.emptyTicketsTitle}>لا توجد لديك تذاكر دعم مفتوحة</Text>
                    <Text style={styles.emptyTicketsDesc}>
                      فريق الدعم جاهز دائماً لمساعدتك في حال واجهت أي استفسار أو مشكلة في الطلبات.
                    </Text>
                  </View>
                )}

                {!loadingTickets &&
                  tickets.map((ticket, index) => {
                    const statusBadge = getStatusBadge(ticket.status, ticket.status_display);
                    const isExpanded = expandedTicketId === ticket.id;
                    const messages = ticketMessages[ticket.id] || [];

                    return (
                      <Animated.View
                        key={ticket.id}
                        entering={FadeInUp.delay(index * 60).springify()}
                        style={styles.ticketCard}
                      >
                        <TouchableOpacity
                          style={styles.ticketHeader}
                          onPress={() => handleToggleTicketDetails(ticket.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.ticketNumberRow}>
                            <Text style={styles.ticketNum}>{ticket.ticket_number}</Text>
                            <View
                              style={[
                                styles.ticketStatusBadge,
                                { backgroundColor: statusBadge.bg },
                              ]}
                            >
                              <Text
                                style={[styles.ticketStatusText, { color: statusBadge.text }]}
                              >
                                {statusBadge.label}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.ticketSubject}>{ticket.subject}</Text>

                          <View style={styles.ticketMetaRow}>
                            <Text style={styles.ticketCategoryBadge}>
                              {ticket.category_display}
                            </Text>
                            <View style={styles.ticketDateRow}>
                              <Clock size={12} color="#9CA3AF" />
                              <Text style={styles.ticketDateText}>
                                {new Date(ticket.created_at).toLocaleDateString('ar-EG')}
                              </Text>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={18} color="#6B7280" />
                            ) : (
                              <ChevronDown size={18} color="#6B7280" />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Expandable Thread & Messages */}
                        {isExpanded && (
                          <View style={styles.ticketExpandedContent}>
                            <View style={styles.threadDivider} />
                            <Text style={styles.threadTitle}>محادثة التذكرة:</Text>

                            {messages.length === 0 ? (
                              <ActivityIndicator size="small" color={Colors.light.primary} />
                            ) : (
                              messages.map((msg) => (
                                <View
                                  key={msg.id}
                                  style={[
                                    styles.msgBubble,
                                    msg.sender_role === 'CUSTOMER'
                                      ? styles.customerMsg
                                      : styles.agentMsg,
                                  ]}
                                >
                                  <Text style={styles.msgSender}>{msg.sender_name}</Text>
                                  <Text style={styles.msgText}>{msg.message_text}</Text>
                                </View>
                              ))
                            )}

                            {/* Reply Input (if not closed) */}
                            {ticket.status !== 'CLOSED' && (
                              <View style={styles.replyRow}>
                                <TextInput
                                  style={styles.replyInput}
                                  placeholder="اكتب ردك هنا..."
                                  placeholderTextColor="#9CA3AF"
                                  value={replyText}
                                  onChangeText={setReplyText}
                                />
                                <TouchableOpacity
                                  style={[
                                    styles.sendReplyBtn,
                                    (!replyText.trim() || sendingReply) && styles.sendReplyBtnDisabled,
                                  ]}
                                  onPress={() => handleSendReply(ticket.id)}
                                  disabled={!replyText.trim() || sendingReply}
                                  activeOpacity={0.8}
                                >
                                  {sendingReply ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <Send size={16} color="#FFFFFF" />
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        )}
                      </Animated.View>
                    );
                  })}
              </>
            )}
          </>
        )}

        {/* TAB 2: FAQS */}
        {activeTab === 'faqs' && (
          <View style={styles.faqsList}>
            {FAQS.map((faq, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <Animated.View
                  key={index}
                  entering={FadeInUp.delay(index * 50).springify()}
                  style={styles.faqCard}
                >
                  <TouchableOpacity
                    style={styles.faqHeader}
                    onPress={() => setExpandedFaq(isExpanded ? null : index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    {isExpanded ? (
                      <ChevronUp size={20} color={Colors.light.primary} />
                    ) : (
                      <ChevronDown size={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.faqAnswerContainer}>
                      <Text style={styles.faqAnswer}>{faq.a}</Text>
                    </Animated.View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* New Ticket Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)}>
              <X size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>فتح تذكرة دعم جديدة</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Subject */}
            <Text style={styles.fieldLabel}>عنوان المشكلة أو الاستفسار</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="مثال: لم يصل الطلب كاملاً..."
              placeholderTextColor="#9CA3AF"
              value={newSubject}
              onChangeText={setNewSubject}
            />

            {/* Category */}
            <Text style={styles.fieldLabel}>تصنيف الشكوى</Text>
            <View style={styles.categoryChipsContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    newCategory === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setNewCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      newCategory === cat.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message Details */}
            <Text style={styles.fieldLabel}>تفاصيل المشكلة بالتفصيل</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="اكتب جميع التفاصيل لمساعدة فريق الدعم في حل مشكلتك سريعاً..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              value={newMessage}
              onChangeText={setNewMessage}
            />

            <TouchableOpacity
              style={[
                styles.submitTicketBtn,
                (!newSubject.trim() || !newMessage.trim() || isSubmittingTicket) &&
                  styles.submitTicketBtnDisabled,
              ]}
              onPress={handleCreateTicket}
              disabled={!newSubject.trim() || !newMessage.trim() || isSubmittingTicket}
              activeOpacity={0.8}
            >
              {isSubmittingTicket ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitTicketBtnText}>إرسال التذكرة لفريق الدعم</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  channelsContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  channelCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  channelText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#374151',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Colors.light.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Tajawal_700Bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  authPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 20,
  },
  authPromptIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  authPromptTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  authPromptSubtitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  ticketActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ticketsSectionHeading: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  newTicketInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  newTicketInlineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  emptyTicketsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 10,
  },
  emptyTicketsTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyTicketsDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  ticketHeader: {
    padding: 14,
  },
  ticketNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNum: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  ticketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ticketStatusText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  ticketSubject: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'left',
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketCategoryBadge: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ticketDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketDateText: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
  },
  ticketExpandedContent: {
    padding: 14,
    paddingTop: 0,
    backgroundColor: '#FAFAFA',
  },
  threadDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  threadTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'left',
  },
  msgBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  customerMsg: {
    backgroundColor: '#FCE7F3',
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  agentMsg: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  msgSender: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
    marginBottom: 2,
    textAlign: 'left',
  },
  msgText: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#111827',
    lineHeight: 18,
    textAlign: 'left',
  },
  replyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  replyInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#111827',
    textAlign: 'right',
  },
  sendReplyBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendReplyBtnDisabled: {
    opacity: 0.5,
  },
  faqsList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
    marginRight: 12,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  faqAnswer: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#4B5563',
    lineHeight: 22,
    textAlign: 'left',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#374151',
    marginBottom: 8,
    marginTop: 14,
    textAlign: 'left',
  },
  modalInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#111827',
    textAlign: 'right',
  },
  modalTextArea: {
    height: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    color: '#4B5563',
  },
  categoryChipTextActive: {
    color: Colors.light.primary,
    fontFamily: 'Tajawal_700Bold',
  },
  submitTicketBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  submitTicketBtnDisabled: {
    opacity: 0.5,
  },
  submitTicketBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
});
