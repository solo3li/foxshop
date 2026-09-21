import React, { useEffect, useState, useRef } from 'react';
import { 
  Headphones, 
  Phone, 
  MessageCircle, 
  Plus, 
  Search, 
  Send, 
  Paperclip, 
  Mic, 
  Square, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  ArrowRight, 
  FileText, 
  Download, 
  RefreshCw,
  Tag,
  AlertTriangle,
  Flame,
  LifeBuoy
} from 'lucide-react';
import { useSupportStore } from '../store/supportStore';
import { NewTicketModal } from './NewTicketModal';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import type { SupportTicket, TicketMessage } from '../types';

const normalizeMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
};

const MediaAttachmentView: React.FC<{
  attachment: string;
  type?: 'image' | 'audio' | 'video' | 'file' | null;
  isMerchant: boolean;
}> = ({ attachment, type, isMerchant }) => {
  const [imgError, setImgError] = useState(false);
  const normalizedUrl = normalizeMediaUrl(attachment);

  const isAudio = type === 'audio' || attachment.match(/\.(webm|weba|mp3|ogg|wav|m4a)$/i) || attachment.includes('voice_');
  const isVideo = type === 'video' || attachment.match(/\.(mp4|mov|mkv)$/i);
  const isImage = !isAudio && !isVideo && (type === 'image' || attachment.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i));

  if (isAudio) {
    return (
      <div className="mt-1.5">
        <VoiceNotePlayer src={normalizedUrl} isMerchant={isMerchant} />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-2.5 pt-2 border-t border-black/10">
        <video controls src={normalizedUrl} className="max-h-56 rounded-xl w-full" />
      </div>
    );
  }

  if (isImage && !imgError) {
    return (
      <div className="mt-2.5 pt-2 border-t border-black/10">
        <a href={normalizedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-black/5">
          <img 
            src={normalizedUrl} 
            alt="مرفق" 
            onError={() => setImgError(true)}
            className="max-h-56 max-w-full object-cover rounded-xl hover:opacity-95 transition-opacity" 
          />
        </a>
      </div>
    );
  }

  // Fallback or generic file
  return (
    <div className="mt-2.5 pt-2 border-t border-black/10">
      <a 
        href={normalizedUrl} 
        target="_blank" 
        rel="noreferrer" 
        className={`
          flex items-center gap-2 p-2.5 rounded-xl transition-colors font-bold text-[11px]
          ${isMerchant ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}
        `}
      >
        <FileText size={18} className="shrink-0" />
        <span className="truncate flex-1">
          {attachment.split('/').pop() || 'مستند مرفق'}
        </span>
        <Download size={14} className="mr-auto shrink-0" />
      </a>
    </div>
  );
};

export const SupportCenter: React.FC = () => {
  const {
    tickets,
    activeTicket,
    activeFilter,
    isLoading,
    isSending,
    setActiveFilter,
    setActiveTicket,
    fetchTickets,
    fetchTicketDetail,
    sendMessage,
    closeTicket
  } = useSupportStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeTicket?.messages]);

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTicket) return;
    if (!messageText.trim() && !selectedFile) return;

    const textToSend = messageText.trim();
    const fileToSend = selectedFile;

    setMessageText('');
    setSelectedFile(null);

    await sendMessage(activeTicket.id, textToSend, fileToSend || undefined);
  };

  // Handle Voice Recording
  const startRecording = async () => {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        if (activeTicket) {
          await sendMessage(activeTicket.id, 'تسجيل صوتي 🎙️', audioFile);
        }
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن للمتصفح.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Clear chunks so it doesn't send
      audioChunksRef.current = [];
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.order_number && ticket.order_number.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'OPEN') {
      return ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_USER';
    }
    if (activeFilter === 'CLOSED') {
      return ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
    }
    return true;
  });

  // Ticket stats
  const openCount = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_USER').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">جديدة 🔵</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">قيد المعالجة 🟡</span>;
      case 'WAITING_USER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">بانتظار ردك 🟣</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">تم الحل 🟢</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">مغلقة ⚪</span>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white">طوارئ / حرجة</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">عاجلة</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
      {/* Top Header & Fast Help Channels */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Headphones size={22} className="text-primary" />
            <span>مركز الدعم الفني والمساعدة</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            متابعة استفساراتك، طوارئ الطلبات الحية، والتواصل الفوري مع فريق عمليات فوكس شوب.
          </p>
        </div>

        {/* Quick Contact & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hotline */}
          <a
            href="tel:920000000"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200"
            title="الاتصال بالخط الساخن المباشر"
          >
            <Phone size={15} className="text-emerald-600" />
            <span>الخط الساخن 9200</span>
          </a>

          {/* WhatsApp */}
          <a
            href="https://wa.me/966500000000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200"
            title="محادثة واتساب سريعة"
          >
            <MessageCircle size={15} className="text-emerald-600" />
            <span>واتساب الدعم</span>
          </a>

          {/* New Ticket */}
          <button
            onClick={() => setIsNewTicketModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-pink-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            <span>+ فتح تذكرة جديدة</span>
          </button>
        </div>
      </div>

      {/* Main Split-View Area */}
      <div className="flex-1 flex bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-0">
        {/* Right Column: Ticket List */}
        <div className={`
          w-full md:w-80 lg:w-96 border-l border-slate-200 flex flex-col shrink-0 bg-slate-50/50
          ${activeTicket ? 'hidden md:flex' : 'flex'}
        `}>
          {/* List Header & Filters */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم التذكرة أو الموضوع..."
                className="w-full pr-8 pl-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'ALL' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                الكل ({tickets.length})
              </button>
              <button
                onClick={() => setActiveFilter('OPEN')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'OPEN' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                النشطة ({openCount})
              </button>
              <button
                onClick={() => setActiveFilter('CLOSED')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'CLOSED' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                المغلقة ({resolvedCount})
              </button>
            </div>
          </div>

          {/* Tickets Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center">
                <RefreshCw size={20} className="animate-spin text-primary mb-2" />
                <span>جاري تحميل التذاكر...</span>
              </div>
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map(t => {
                const isSelected = activeTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className={`
                      p-3 rounded-xl cursor-pointer transition-all border
                      ${isSelected 
                        ? 'bg-white border-primary shadow-sm ring-1 ring-primary/20' 
                        : 'bg-white/80 border-slate-100 hover:bg-white hover:border-slate-200'}
                    `}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-extrabold text-[11px] text-primary">{t.ticket_number}</span>
                      <div className="flex items-center gap-1">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>

                    <h4 className="font-bold text-xs text-slate-800 line-clamp-1 mb-1">{t.subject}</h4>

                    {t.order_number && (
                      <span className="inline-block mb-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                        طلب #{t.order_number}
                      </span>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span className="truncate max-w-[150px]">
                        {t.last_message?.message_text || t.category_display || 'تذكرة دعم'}
                      </span>
                      <span>{new Date(t.updated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                لا توجد أي تذاكر مطابقة.
              </div>
            )}
          </div>
        </div>

        {/* Left Column: Chat Room & Ticket Details */}
        <div className={`
          flex-1 flex-col h-full bg-white
          ${activeTicket ? 'flex' : 'hidden md:flex'}
        `}>
          {activeTicket ? (
            <>
              {/* Ticket Room Header */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => setActiveTicket(null)}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 md:hidden"
                    title="الرجوع للقائمة"
                  >
                    <ArrowRight size={20} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-primary">{activeTicket.ticket_number}</span>
                      {getStatusBadge(activeTicket.status)}
                      {getPriorityBadge(activeTicket.priority)}
                    </div>
                    <h3 className="font-black text-sm text-slate-800 truncate mt-0.5">{activeTicket.subject}</h3>
                    {activeTicket.order_number && (
                      <span className="text-[10px] font-bold text-slate-500">
                        مرتبطة بطلب رقم: #{activeTicket.order_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Close ticket action */}
                {activeTicket.status !== 'CLOSED' && (
                  <button
                    onClick={() => closeTicket(activeTicket.id)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all shrink-0"
                    title="إغلاق التذكرة بعد انتهاء المشكلة"
                  >
                    إغلاق التذكرة
                  </button>
                )}
              </div>

              {/* Chat Message Timeline */}
              <div 
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30"
              >
                {activeTicket.messages && activeTicket.messages.length > 0 ? (
                  activeTicket.messages.map((msg) => {
                    const isMerchant = msg.sender_role === 'MERCHANT' || msg.sender_name.includes('merchant');
                    const hasAudio = msg.attachment_type === 'audio' || (msg.attachment && (msg.attachment.includes('voice_') || msg.attachment.match(/\.(webm|weba|mp3|ogg|wav|m4a)$/i)));
                    const isVoiceNoteOnly = hasAudio && msg.message_text.includes('تسجيل صوتي');

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMerchant ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                          <span className="font-bold">{isMerchant ? 'أنت (التاجر)' : (msg.sender_name || 'خدمة العملاء')}</span>
                          <span>•</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div className={`
                          max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs shadow-xs
                          ${hasAudio || msg.attachment ? 'min-w-[280px] sm:min-w-[320px]' : ''}
                          ${isMerchant 
                            ? 'bg-primary text-white rounded-br-none' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}
                        `}>
                          {/* Message Text */}
                          {(!isVoiceNoteOnly || !hasAudio) && (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                          )}

                          {/* Media Attachments Preview */}
                          {msg.attachment && (
                            <MediaAttachmentView 
                              attachment={msg.attachment} 
                              type={msg.attachment_type} 
                              isMerchant={isMerchant} 
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center text-slate-400 text-xs font-bold">
                    لا توجد رسائل بعد في هذه التذكرة.
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              {activeTicket.status !== 'CLOSED' ? (
                <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                  {/* Selected file preview */}
                  {selectedFile && (
                    <div className="mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <span className="truncate font-bold text-slate-700">📎 {selectedFile.name}</span>
                      <button 
                        onClick={() => setSelectedFile(null)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Voice recording UI or standard input */}
                  {isRecording ? (
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-200 p-2 rounded-xl">
                      <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                        <span>جاري التسجيل الصوتي ({recordingSeconds} ثانية)...</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelRecording}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-200"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1"
                        >
                          <Square size={12} />
                          <span>إيقاف وإرسال</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      {/* Attach File Button */}
                      <label className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer transition-colors" title="إرفاق صورة أو ملف">
                        <Paperclip size={18} />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,video/*,audio/*,application/pdf"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                      </label>

                      {/* Voice Note Button */}
                      <button
                        type="button"
                        onClick={startRecording}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                        title="تسجيل رسالة صوتية سريعة"
                      >
                        <Mic size={18} />
                      </button>

                      {/* Text Input */}
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="اكتب ردك هنا..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />

                      {/* Send Button */}
                      <button
                        type="submit"
                        disabled={isSending || (!messageText.trim() && !selectedFile)}
                        className="p-2 rounded-xl bg-primary hover:bg-pink-700 text-white transition-all disabled:opacity-40"
                        title="إرسال"
                      >
                        {isSending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-500">
                  تم إغلاق هذه التذكرة. يمكنك فتح تذكرة جديدة إذا كانت لديك استفسارات أخرى.
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <LifeBuoy size={48} className="text-slate-300 mb-3" />
              <h3 className="font-extrabold text-sm text-slate-600">اختر تذكرة من القائمة لعرض المحادثة</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                يمكنك التحدث مع مسؤولي الدعم، إرفاق صور وفواتير أو تسجيلات صوتية لحل المشاكل بأسرع وقت.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
      />
    </div>
  );
};
