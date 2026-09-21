import React, { useEffect, useState } from 'react';
import { 
  ArrowRight, 
  Printer, 
  AlertTriangle, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Bike, 
  CreditCard, 
  ShieldCheck, 
  ChefHat, 
  Package, 
  AlertCircle,
  ExternalLink,
  MessageSquare,
  FileText
} from 'lucide-react';
import type { Order } from '../types';
import { api } from '../api/client';
import { OrderEmergencyModal } from './OrderEmergencyModal';

interface OrderDetailPageProps {
  orderId: string;
  onBack: () => void;
  onNavigateToSupport?: () => void;
  onOrderStatusUpdated?: (updatedOrder: Order) => void;
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({
  orderId,
  onBack,
  onNavigateToSupport,
  onOrderStatusUpdated
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.getOrderDetail(orderId);
    if (res.data) {
      setOrder(res.data);
    } else {
      setError(res.error || 'تعذر تحميل تفاصيل الطلب');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDetail();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED') => {
    if (!order || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    const res = await api.updateOrderStatus(order.id, newStatus);
    if (res.data) {
      setOrder(res.data);
      if (onOrderStatusUpdated) {
        onOrderStatusUpdated(res.data);
      }
    } else {
      alert(res.error || 'تعذر تحديث حالة الطلب');
    }
    setIsUpdatingStatus(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'بانتظار الموافقة', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'CONFIRMED':
        return { label: 'تم التأكيد', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'PREPARING':
        return { label: 'قيد التحضير في المطبخ', bg: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'READY_FOR_PICKUP':
        return { label: 'جاهز للاستلام', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY':
      case 'ON_THE_WAY':
        return { label: 'في الطريق مع الكابتن', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'DELIVERED':
        return { label: 'تم التسليم بنجاح', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'CANCELLED':
        return { label: 'ملغي', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  // Timeline Stepper Logic
  const getTimelineSteps = () => {
    const isCancelled = order?.status === 'CANCELLED';
    if (isCancelled) {
      return [
        { key: 'created', label: 'تم الطلب', done: true, current: false },
        { key: 'cancelled', label: 'تم الإلغاء', done: true, current: true, isError: true },
      ];
    }

    const steps = [
      { key: 'PENDING', label: 'تم إنشاء الطلب', done: true },
      { key: 'CONFIRMED', label: 'تأكيد الطلب', done: order?.status !== 'PENDING' },
      { key: 'PREPARING', label: 'قيد التحضير', done: ['PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'ON_THE_WAY', 'DELIVERED'].includes(order?.status || '') },
      { key: 'READY_FOR_PICKUP', label: 'جاهز للاستلام', done: ['READY_FOR_PICKUP', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'ON_THE_WAY', 'DELIVERED'].includes(order?.status || '') },
      { key: 'DELIVERED', label: 'تم التسليم', done: order?.status === 'DELIVERED' },
    ];

    return steps;
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-bold text-slate-500">جاري تحميل تفاصيل الطلب...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle size={48} className="text-rose-500 mb-3" />
        <h3 className="text-lg font-black text-slate-800 mb-1">تعذر العثور على الطلب</h3>
        <p className="text-sm text-slate-500 mb-4">{error || 'قد يكون الطلب غير متاح أو تم حذفه'}</p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
        >
          <ArrowRight size={16} />
          العودة لسجل الطلبات
        </button>
      </div>
    );
  }

  const badge = getStatusBadge(order.status);
  const driver = order.delivery_info;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-black"
            title="العودة لسجل الطلبات"
          >
            <ArrowRight size={16} />
            <span className="hidden sm:inline">سجل الطلبات</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                طلب #{order.order_number || order.id.slice(0, 8).toUpperCase()}
              </h2>
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              تاريخ الطلب: {new Date(order.created_at).toLocaleString('ar-SA')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="طباعة إيصال المطبخ KOT"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">طباعة الإيصال (KOT)</span>
          </button>

          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-black transition-all cursor-pointer"
            title="إبلاغ عن طوارئ بهذا الطلب"
          >
            <AlertTriangle size={15} />
            <span>طلب مساعدة طارئة</span>
          </button>
        </div>
      </div>

      {/* Interactive Status Transition Actions (If active) */}
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <ChefHat size={22} className="text-primary" />
            <div>
              <p className="text-xs font-extrabold">التحكم في حالة الطلب المباشرة</p>
              <p className="text-[11px] text-slate-300">قم بتحديث حالة تجهيز الوجبات في المطبخ لإشعار العميل والكابتن فوراً</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.status === 'PENDING' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus('CONFIRMED')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                الموافقة والتأكيد
              </button>
            )}
            {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus('PREPARING')}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-pink-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                بدء التحضير 🍳
              </button>
            )}
            {order.status === 'PREPARING' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus('READY_FOR_PICKUP')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                جاهز للاستلام ✅
              </button>
            )}
            <button
              disabled={isUpdatingStatus}
              onClick={() => {
                if (window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟')) {
                  handleUpdateStatus('CANCELLED');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-rose-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              إلغاء الطلب
            </button>
          </div>
        </div>
      )}

      {/* Timeline Stepper */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h4 className="text-xs font-black text-slate-500 mb-4 flex items-center gap-1.5">
          <Clock size={14} />
          مسار مراحل الطلب
        </h4>
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-1 bg-slate-100 z-0"></div>
          {getTimelineSteps().map((step, idx) => {
            const isDone = step.done;
            return (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
                    ${isDone 
                      ? 'bg-primary text-white ring-4 ring-primary/20 shadow-xs' 
                      : 'bg-slate-200 text-slate-500'}
                  `}
                >
                  {isDone ? <CheckCircle2 size={15} /> : idx + 1}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-bold text-center ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Details & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Customer & Delivery Driver Cards (1 col) */}
        <div className="space-y-5">
          {/* Captain / Delivery Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Bike size={16} className="text-primary" />
                بيانات كابتن التوصيل
              </h4>
              {driver?.status_display && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {driver.status_display}
                </span>
              )}
            </div>

            {driver && driver.driver_name ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">اسم الكابتن:</span>
                  <span className="font-extrabold text-slate-900">{driver.driver_name}</span>
                </div>
                {driver.driver_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">رقم الجوال:</span>
                    <a 
                      href={`tel:${driver.driver_phone}`} 
                      dir="ltr" 
                      className="font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Phone size={12} />
                      {driver.driver_phone}
                    </a>
                  </div>
                )}
                {driver.delivery_otp && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <span className="text-amber-800 font-bold text-[11px]">كود الاستلام (OTP):</span>
                    <span className="font-black text-amber-900 tracking-wider text-sm font-mono">{driver.delivery_otp}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                <p className="font-bold">جاري البحث عن كابتن مؤهل للطلب</p>
                <span className="text-[10px] text-slate-400">سيتم إشعارك فور تعيين كابتن من النظام الآلي</span>
              </div>
            )}
          </div>

          {/* Customer & Destination Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin size={16} className="text-emerald-600" />
              بيانات العميل وعنوان التوصيل
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">العميل:</span>
                <span className="font-extrabold text-slate-900">{order.customer_name || 'عميل فوكس شوب'}</span>
              </div>
              {order.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">رقم الهاتف:</span>
                  <a 
                    href={`tel:${order.customer_phone}`} 
                    dir="ltr" 
                    className="font-bold text-slate-800 hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Phone size={12} />
                    {order.customer_phone}
                  </a>
                </div>
              )}
              {order.delivery_address_display && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-bold block mb-1">العنوان:</span>
                  <p className="text-slate-700 text-[11px] leading-relaxed bg-slate-50 p-2 rounded-xl">
                    {order.delivery_address_display}
                  </p>
                </div>
              )}
              {order.customer_notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-amber-700 font-black block mb-1">ملاحظات العميل الخاصة:</span>
                  <p className="text-amber-900 text-[11px] bg-amber-50/70 p-2 rounded-xl border border-amber-200">
                    {order.customer_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Invoice Items Breakdown & Financials (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items Breakdown Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Package size={16} className="text-primary" />
              تفاصيل أصناف الطلب ({order.items ? order.items.length : 0} صنف)
            </h4>

            <div className="divide-y divide-slate-100">
              {order.items && order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-pink-50 text-primary font-black flex items-center justify-center shrink-0 text-xs">
                      {item.quantity}×
                    </span>
                    <div>
                      <p className="font-extrabold text-slate-900">{item.menu_item_name}</p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.modifiers.map((mod, mIdx) => (
                            <span key={mIdx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                              + {mod.name} ({Number(mod.price_delta) > 0 ? `+${Number(mod.price_delta).toFixed(2)} ر.س` : 'مجاني'})
                            </span>
                          ))}
                        </div>
                      )}
                      {item.special_instructions && (
                        <p className="text-[11px] text-amber-600 font-bold mt-1">
                          تعليمات: {item.special_instructions}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="font-black text-slate-900">
                      {Number(item.total_price || (Number(item.unit_price) * item.quantity)).toFixed(2)} ر.س
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      ({Number(item.unit_price || 0).toFixed(2)} ر.س للقطعة)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financials & Payment Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <CreditCard size={16} className="text-blue-600" />
              الملخص المالي وطريقة السداد
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>المجموع الفرعي للوجبات:</span>
                <span className="font-bold text-slate-800">{Number(order.subtotal || order.total_amount).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>رسوم التوصيل:</span>
                <span className="font-bold text-slate-800">{Number(order.delivery_fee || 0).toFixed(2)} ر.س</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>الخصم المطبق:</span>
                  <span>- {Number(order.discount_amount).toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-black text-slate-900">المبلغ الإجمالي المستحق:</span>
                <span className="font-black text-primary text-base">
                  {Number(order.total_amount).toFixed(2)} ر.س
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">طريقة الدفع:</span>
                <span className="font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                  {order.payment_method === 'COD' ? 'الدفع نقداً عند الاستلام (كاش)' : 'دفع إلكتروني (بطاقة/محفظة)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">حالة السداد:</span>
                <span className={`font-black px-2 py-0.5 rounded-md text-[11px] ${
                  order.is_paid || order.payment_status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.is_paid || order.payment_status === 'PAID' ? 'تم الدفع بنجاح' : 'معلق / تحصيل عند الاستلام'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Order Emergency Modal */}
      {showEmergencyModal && (
        <OrderEmergencyModal
          order={order}
          isOpen={showEmergencyModal}
          onClose={() => setShowEmergencyModal(false)}
          onOpenTicket={() => {
            setShowEmergencyModal(false);
            if (onNavigateToSupport) {
              onNavigateToSupport();
            }
          }}
        />
      )}
    </div>
  );
};
