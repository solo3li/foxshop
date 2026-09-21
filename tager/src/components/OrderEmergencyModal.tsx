import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Send, 
  Paperclip, 
  CheckCircle2, 
  RefreshCw,
  Bike,
  PhoneCall,
  DollarSign,
  Utensils,
  HelpCircle
} from 'lucide-react';
import type { Order } from '../types';
import { useSupportStore } from '../store/supportStore';

interface OrderEmergencyModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onOpenTicket: () => void;
}

const EMERGENCY_REASONS = [
  { id: 'driver_delay', label: 'تأخر الكابتن عن الاستلام', icon: Bike, priority: 'HIGH' as const },
  { id: 'customer_unreachable', label: 'العميل لا يجيب على الهاتف', icon: PhoneCall, priority: 'HIGH' as const },
  { id: 'compensation_cancel', label: 'طلب تعويض عن إلغاء بعد الطهي', icon: DollarSign, priority: 'CRITICAL' as const },
  { id: 'item_issue', label: 'مشكلة في أصناف الطلب أو التجهيز', icon: Utensils, priority: 'MEDIUM' as const },
  { id: 'other', label: 'حالة طارئة أخرى', icon: HelpCircle, priority: 'HIGH' as const },
];

export const OrderEmergencyModal: React.FC<OrderEmergencyModalProps> = ({
  order,
  isOpen,
  onClose,
  onOpenTicket,
}) => {
  const { createTicket, isSending } = useSupportStore();
  const [selectedReason, setSelectedReason] = useState(EMERGENCY_REASONS[0].label);
  const [selectedPriority, setSelectedPriority] = useState<'HIGH' | 'CRITICAL' | 'MEDIUM'>('HIGH');
  const [details, setDetails] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSelectReason = (reason: typeof EMERGENCY_REASONS[0]) => {
    setSelectedReason(reason.label);
    setSelectedPriority(reason.priority);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const subject = `طوارئ طلب #${order.order_number || order.pickup_code || order.id.slice(0, 6)}: ${selectedReason}`;
    const initialMessage = details.trim() 
      ? `${selectedReason}\n\nتفاصيل إضافية: ${details.trim()}`
      : `إبلاغ عاجل من التاجر بخصوص هذا الطلب: ${selectedReason}`;

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('initial_message', initialMessage);
    formData.append('order', order.id);
    formData.append('category', 'ORDER_ISSUE');
    formData.append('priority', selectedPriority);
    if (attachment) {
      formData.append('attachment', attachment);
    }

    const res = await createTicket(formData);
    if (res) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        onOpenTicket();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-500 to-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle size={20} className="animate-pulse" />
            <span>طلب مساعدة فورية للدعم بخصوص الطلب</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">تم إرسال بلاغ الطوارئ لفريق الدعم!</h3>
            <p className="text-xs text-slate-500">جاري نقلك لغرفة المحادثة مع فريق الدعم للمتابعة الفورية...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Order Card Preview */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-black text-slate-800 text-sm block">
                  طلب #{order.order_number || order.pickup_code || order.id.slice(0, 6)}
                </span>
                <span className="text-slate-500 mt-0.5 block">
                  العميل: <strong>{order.customer_name}</strong> {order.customer_phone ? `(${order.customer_phone})` : ''}
                </span>
              </div>
              <div className="text-left font-black text-primary text-sm">
                {order.total_amount} ر.س
              </div>
            </div>

            {/* Quick Reason Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                اختر سبب المشكلة السريع <span className="text-rose-500">*</span>:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EMERGENCY_REASONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedReason === r.label;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectReason(r)}
                      className={`
                        p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 text-xs font-bold
                        ${isSelected 
                          ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      <Icon size={16} className={isSelected ? 'text-rose-600' : 'text-slate-400'} />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional details */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تفاصيل إضافية لمسؤول الدعم (اختياري):
              </label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="اكتب أي ملاحظة سريعة تساعد فريق الدعم على سرعة حل المشكلة..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
              />
            </div>

            {/* Attachment */}
            <div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">
                <Paperclip size={14} />
                <span>{attachment ? attachment.name : 'إرفاق صورة / فاتورة (اختياري)'}</span>
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

            {/* Footer Buttons */}
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
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-primary hover:opacity-95 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-rose-600/20"
              >
                {isSending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                <span>إرسال للدعم فوراً</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
