import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Paperclip, 
  Headphones, 
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useSupportStore } from '../store/supportStore';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'MERCHANT_INQUIRY', label: 'استفسار عام أو تشغيلي' },
  { value: 'PAYMENT_DISPUTE', label: 'تسويات مالية وتحويل الأرباح' },
  { value: 'ORDER_ISSUE', label: 'مشكلة متعلقة بطلب' },
  { value: 'FOOD_QUALITY', label: 'جودة وتلف مواد أو طلبات' },
  { value: 'OTHER', label: 'موضوع آخر' },
];

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ isOpen, onClose }) => {
  const { createTicket, isSending } = useSupportStore();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [initialMessage, setInitialMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) return;

    const formData = new FormData();
    formData.append('subject', subject.trim());
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('initial_message', initialMessage.trim());
    if (attachment) {
      formData.append('attachment', attachment);
    }

    const res = await createTicket(formData);
    if (res) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <Headphones size={20} className="text-primary" />
            <span>فتح تذكرة دعم فني جديدة</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        {success ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">تم إنشاء التذكرة بنجاح!</h3>
            <p className="text-xs text-slate-500">فريق الدعم الفني سيتولى مراجعتها والرد عليك في أقرب وقت.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                عنوان التذكرة / المشكلة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: استفسار حول تحويل الأرباح الأسبوعي..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تصنيف المشكلة
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الأولوية
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="LOW">عادية / منخفضة</option>
                  <option value="MEDIUM">متوسطة</option>
                  <option value="HIGH">عاجلة / مرتفعة</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                شرح التفاصيل <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="اشرح المشكلة أو الاستفسار بالتفصيل..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">
                <Paperclip size={14} />
                <span>{attachment ? attachment.name : 'إرفاق مستند أو صورة (اختياري)'}</span>
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
              </label>
              {attachment && (
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="mr-2 text-xs text-rose-500 font-bold hover:underline"
                >
                  إلغاء المرفق
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-pink-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20"
              >
                {isSending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                <span>إرسال التذكرة</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
