import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSupportStore, TicketMessage } from '../../store/supportStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import {
  ArrowRight,
  Send,
  Paperclip,
  Mic,
  Square,
  X,
  Clock,
  CheckCheck,
  Headphones,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { MediaAttachmentView } from '../../components/MediaAttachmentView';
import { centrifugo } from '../../services/centrifugo';

export default function TicketChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useThemeStore();
  const { user } = useAuthStore();
  const {
    activeTicket,
    isLoading,
    isSending,
    fetchTicketDetail,
    sendMessage,
    closeTicket,
    addIncomingMessage,
  } = useSupportStore();

  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (id) {
      fetchTicketDetail(id);
    }
  }, [id]);

  // Centrifugo realtime subscription
  useEffect(() => {
    if (!id) return;

    const channel = `support:ticket_${id}`;
    const unsubscribe = centrifugo.subscribe(channel, (data) => {
      if (data?.message_id && data?.ticket_id === id) {
        const incomingMsg: TicketMessage = {
          id: data.message_id,
          ticket: data.ticket_id,
          sender: data.sender_id,
          sender_name: data.sender_name || 'خدمة العملاء',
          sender_role: data.sender_role || 'STAFF',
          message_text: data.message_text || '',
          attachment: data.attachment || null,
          attachment_type: null,
          is_internal_note: !!data.is_internal_note,
          created_at: data.created_at || new Date().toISOString(),
        };
        addIncomingMessage(id, incomingMsg);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  // Auto scroll on messages change
  useEffect(() => {
    if (activeTicket?.messages && activeTicket.messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [activeTicket?.messages?.length]);

  const handlePickFile = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!id) return;
    if (!messageText.trim() && !selectedFile) return;

    const textToSend = messageText.trim();
    const fileToSend = selectedFile;

    setMessageText('');
    clearSelectedFile();

    await sendMessage(id, textToSend, fileToSend);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  // Voice recording
  const startRecording = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('تنبيه', 'التسجيل الصوتي متاح في المتصفح');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0 && id) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
            type: 'audio/webm',
          });
          await sendMessage(id, 'تسجيل صوتي 🎙️', audioFile);
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert('خطأ', 'تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن للمتصفح.');
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stream?.getTracks().forEach((track: any) => track.stop());
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleCloseTicket = () => {
    Alert.alert('إغلاق التذكرة', 'هل تود بالتأكيد إغلاق هذه التذكرة وحلها؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'نعم، إغلاق',
        style: 'destructive',
        onPress: async () => {
          if (id) await closeTicket(id);
        },
      },
    ]);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isClosed = activeTicket?.status === 'CLOSED';

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

        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={[styles.ticketTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            {activeTicket?.subject || 'جاري تحميل التذكرة...'}
          </Text>
          <View style={styles.ticketSubRow}>
            <Text style={[styles.ticketNumText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              #{activeTicket?.ticket_number || ''}
            </Text>
            <Text style={[styles.dot, { color: colors.border }]}>•</Text>
            <Text
              style={[
                styles.ticketStatusText,
                {
                  color: isClosed ? colors.textSecondary : colors.success,
                  fontFamily: Fonts.bold,
                },
              ]}
            >
              {activeTicket?.status_display || (isClosed ? 'مغلقة' : 'نشطة')}
            </Text>
          </View>
        </View>

        {!isClosed && (
          <TouchableOpacity
            onPress={handleCloseTicket}
            style={[styles.closeActionBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.closeActionText, { color: colors.danger, fontFamily: Fonts.medium }]}>
              إغلاق
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hidden file input for media attachments */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {/* Messages Scroll Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {isLoading && !activeTicket && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}

          {/* Ticket Header Banner */}
          {activeTicket && (
            <View
              style={[
                styles.ticketBanner,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.bannerIconBox, { backgroundColor: colors.primaryLight }]}>
                <Headphones size={22} color={colors.primary} />
              </View>
              <View style={styles.bannerTextContainer}>
                <Text style={[styles.bannerTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
                  فريق دعم فوكس شوب معك على الخط
                </Text>
                <Text
                  style={[
                    styles.bannerSub,
                    { color: colors.textSecondary, fontFamily: Fonts.regular },
                  ]}
                >
                  يمكنك إرسال رسائل نصية، تسجيلات صوتية 🎙️، صور 📷 أو مقاطع فيديو 🎥
                </Text>
              </View>
            </View>
          )}

          {/* Messages List */}
          {(activeTicket?.messages || []).map((msg) => {
            const isMe = msg.sender === user?.id || msg.sender_role === 'DRIVER';

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isMe ? styles.messageRowMe : styles.messageRowOther,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                      : [styles.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  {/* Sender Name if Support */}
                  {!isMe && (
                    <Text style={[styles.senderName, { color: colors.primary, fontFamily: Fonts.bold }]}>
                      {msg.sender_name || 'فريق الدعم'} 🎧
                    </Text>
                  )}

                  {/* Message Text */}
                  {msg.message_text && msg.message_text !== 'تسجيل صوتي 🎙️' && (
                    <Text
                      style={[
                        styles.messageText,
                        {
                          color: isMe ? '#FFFFFF' : colors.text,
                          fontFamily: Fonts.regular,
                        },
                      ]}
                    >
                      {msg.message_text}
                    </Text>
                  )}

                  {/* Attachment if any */}
                  {msg.attachment && (
                    <MediaAttachmentView
                      attachment={msg.attachment}
                      type={msg.attachment_type}
                      isDriver={isMe}
                    />
                  )}

                  {/* Timestamp & check */}
                  <View style={styles.bubbleFooter}>
                    <Text
                      style={[
                        styles.bubbleTime,
                        {
                          color: isMe ? 'rgba(255, 255, 255, 0.75)' : colors.textMuted,
                          fontFamily: Fonts.regular,
                        },
                      ]}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {isMe && <CheckCheck size={13} color="rgba(255, 255, 255, 0.75)" />}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Selected Media File Preview Bar */}
        {selectedFile && (
          <View style={[styles.previewBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={clearSelectedFile} style={styles.clearFileBtn}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text
              numberOfLines={1}
              style={[styles.previewFileName, { color: colors.text, fontFamily: Fonts.medium }]}
            >
              مرفق جاهز: {selectedFile.name}
            </Text>
          </View>
        )}

        {/* Active Audio Recording Bar */}
        {isRecording && (
          <View
            style={[
              styles.recordingBar,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={cancelRecording}
              style={[styles.cancelRecordBtn, { backgroundColor: colors.surface }]}
            >
              <X size={18} color={colors.danger} />
            </TouchableOpacity>

            <View style={styles.recordingCenter}>
              <View style={styles.blinkingDot} />
              <Text style={[styles.recordingTimer, { color: colors.danger, fontFamily: Fonts.bold }]}>
                جاري التسجيل: {formatSeconds(recordingSeconds)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={stopAndSendRecording}
              style={[styles.sendRecordBtn, { backgroundColor: colors.success }]}
            >
              <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Input Bar */}
        {isClosed ? (
          <View style={[styles.closedBanner, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <AlertCircle size={18} color={colors.textSecondary} />
            <Text style={[styles.closedBannerText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              هذه التذكرة تم إغلاقها وحلها بنجاح.
            </Text>
          </View>
        ) : (
          !isRecording && (
            <View
              style={[
                styles.inputBar,
                { backgroundColor: colors.card, borderTopColor: colors.border },
              ]}
            >
              {/* Media Attach Button */}
              <TouchableOpacity
                onPress={handlePickFile}
                activeOpacity={0.7}
                style={[styles.actionIconBtn, { backgroundColor: colors.surface }]}
              >
                <Paperclip size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Voice Record Button */}
              <TouchableOpacity
                onPress={startRecording}
                activeOpacity={0.7}
                style={[styles.actionIconBtn, { backgroundColor: colors.surface }]}
              >
                <Mic size={20} color={colors.primary} />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="اكتب رسالتك للدعم..."
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  styles.chatInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                    fontFamily: Fonts.regular,
                  },
                ]}
              />

              {/* Send Button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={isSending || (!messageText.trim() && !selectedFile)}
                activeOpacity={0.8}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      !messageText.trim() && !selectedFile ? colors.border : colors.primary,
                  },
                ]}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )
        )}
      </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  ticketTitle: {
    fontSize: 15,
  },
  ticketSubRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ticketNumText: {
    fontSize: 11,
  },
  dot: {
    fontSize: 10,
  },
  ticketStatusText: {
    fontSize: 11,
  },
  closeActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  closeActionText: {
    fontSize: 12,
  },
  messagesContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  ticketBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bannerTitle: {
    fontSize: 13,
  },
  bannerSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.xl,
  },
  bubbleMe: {
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'right',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  bubbleFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
  },
  previewBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  clearFileBtn: {
    padding: 4,
  },
  previewFileName: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  recordingBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelRecordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingCenter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  blinkingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimer: {
    fontSize: 14,
  },
  sendRecordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  closedBannerText: {
    fontSize: 13,
  },
  inputBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    textAlign: 'right',
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
