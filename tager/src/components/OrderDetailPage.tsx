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
  Truck,
  CreditCard, 
  ShieldCheck, 
  Package, 
  AlertCircle,
  ExternalLink,
  MessageSquare,
  FileText,
  Scale
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
  const [actualWeights, setActualWeights] = useState<Record<string, string>>({});
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.getOrderDetail(orderId);
    if (res.data) {
      setOrder(res.data);
      const initWeights: Record<string, string> = {};
      res.data.items?.forEach((it) => {
        if (it.is_weighted || it.requested_weight) {
          initWeights[it.id] = String(it.actual_weight || it.requested_weight || '');
        }
      });
      setActualWeights(initWeights);
    } else {
      setError(res.error || 'تعذر تحميل تفاصيل الطلب');
    }
    setIsLoading(false);
  };

  const handleConfirmWeights = async () => {
    if (!order || isSavingWeights) return;
    const itemsToUpdate = Object.entries(actualWeights)
      .filter(([_, val]) => val && !isNaN(parseFloat(val)) && parseFloat(val) > 0)
      .map(([itemId, val]) => ({
        item_id: itemId,
        actual_weight: parseFloat(val),
      }));

    if (itemsToUpdate.length === 0) {
      alert('يرجى إدخال وزن صحيح للأصناف بالوزن المتغير');
      return;
    }

    setIsSavingWeights(true);
    const res = await api.confirmOrderWeights(order.id, itemsToUpdate);
    if (res.data?.order) {
      setOrder(res.data.order);
      if (onOrderStatusUpdated) {
        onOrderStatusUpdated(res.data.order);
      }
      alert('تم تأكيد الوزن الفعلي وإعادة احتساب إجمالي الفاتورة بنجاح!');
    } else {
      alert(res.error || 'تعذر تأكيد الأوزان');
    }
    setIsSavingWeights(false);
  };

  useEffect(() => {
    fetchDetail();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED') => {
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
        return { label: 'قيد التجهيز بالمتجر', bg: 'bg-orange-100 text-orange-800 border-orange-300' };
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
      { key: 'PREPARING', label: 'قيد التجهيز', done: ['PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'ON_THE_WAY', 'DELIVERED'].includes(order?.status || '') },
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
            title="طباعة إيصال التجهيز والطلب"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">طباعة إيصال التجهيز والطلب</span>
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
            <Package size={22} className="text-primary" />
            <div>
              <p className="text-xs font-extrabold">التحكم في حالة الطلب المباشرة</p>
              <p className="text-[11px] text-slate-300">قم بتحديث حالة تجهيز الطلب في المتجر لإشعار العميل والكابتن فوراً</p>
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
                بدء التجهيز 📦
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
            {order.status === 'READY_FOR_PICKUP' && order.restaurant_delivery_mode === 'STORE_OWN_FLEET' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus('ON_THE_WAY')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <Truck size={14} />
                <span>خروج للتوصيل (سائق المتجر) 🛵</span>
              </button>
            )}
            {order.status === 'ON_THE_WAY' && order.restaurant_delivery_mode === 'STORE_OWN_FLEET' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus('DELIVERED')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle2 size={14} />
                <span>تم التسليم للعميل 🏠✅</span>
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
            {order.restaurant_delivery_mode === 'STORE_OWN_FLEET' ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Truck size={16} className="text-indigo-600" />
                    أسطول المتجر الخاص (Store Own Fleet)
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    سائق المتجر
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <p className="font-extrabold">توصيل داخلي بواسطة أسطول المتجر</p>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    يتم توصيل هذا الطلب مباشرة عبر سائقي المتجر الخاصين. تقوم المنصة بتسجيل واحتساب العمولة النظامية فقط بدون إسناده لكباتن المنصة.
                  </p>
                </div>
              </>
            ) : (
              <>
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
              </>
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Package size={16} className="text-primary" />
                تفاصيل أصناف الطلب ({order.items ? order.items.length : 0} صنف)
              </h4>
              {order.is_weight_confirmed ? (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  تم اعتماد الأوزان الفعلية
                </span>
              ) : (
                order.items?.some(it => it.is_weighted || it.requested_weight) && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Scale size={12} />
                    يتطلب وزن فعلي قبل التسليم
                  </span>
                )
              )}
            </div>

            {/* Variable Weight Notice & Confirm Action */}
            {order.items?.some(it => it.is_weighted || it.requested_weight) && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                    <Scale size={14} className="text-amber-600" />
                    أصناف بالوزن المتغير (نموذج إنستاشوب)
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    قم بوزن الأصناف في الميزان وأدخل القيمة الفعلية أدناه، ثم اضغط "تأكيد الوزن الفعلي" لإعادة احتساب قيمة الطلب بدقة وتعديل المبلغ تلقائياً للعميل.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmWeights}
                  disabled={isSavingWeights}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-colors shadow-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Scale size={14} />
                  {isSavingWeights ? 'جاري الاعتماد...' : 'تأكيد الوزن الفعلي'}
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {order.items && order.items.map((item, idx) => {
                const isWeighted = Boolean(item.is_weighted || item.requested_weight || (item.pricing_unit && item.pricing_unit !== 'PIECE'));
                return (
                  <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-pink-50 text-primary font-black flex items-center justify-center shrink-0 text-xs">
                        {item.quantity}×
                      </span>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-slate-900">{item.item_name || item.menu_item_name}</p>
                          {isWeighted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Scale size={11} />
                              صنف بالوزن ({item.pricing_unit || 'كجم'})
                            </span>
                          )}
                        </div>

                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((mod: any, mIdx: number) => (
                              <span key={mIdx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                                + {mod.modifier_name || mod.name} ({Number(mod.price_delta) > 0 ? `+${Number(mod.price_delta).toFixed(2)} ج.م` : 'مجاني'})
                              </span>
                            ))}
                          </div>
                        )}
                        {item.special_instructions && (
                          <p className="text-[11px] text-amber-600 font-bold mt-1">
                            تعليمات: {item.special_instructions}
                          </p>
                        )}

                        {/* Weight Input Box if Item is Weighted */}
                        {isWeighted && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-bold text-slate-600">
                              الوزن التقديري المطلوب: <b className="text-slate-800">{item.requested_weight ?? item.quantity} {item.pricing_unit || 'كجم'}</b>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-black text-slate-700">الوزن الفعلي:</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={actualWeights[item.id] ?? ''}
                                onChange={(e) => setActualWeights({
                                  ...actualWeights,
                                  [item.id]: e.target.value
                                })}
                                className="w-24 px-2 py-1 bg-white rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">{item.pricing_unit || 'كجم'}</span>
                            </div>
                            {item.actual_weight && (
                              <span className="text-[10px] text-emerald-700 font-bold">
                                (المسجل: {item.actual_weight} {item.pricing_unit || 'كجم'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0 self-end sm:self-start">
                      <span className="font-black text-slate-900">
                        {Number(item.total_price || (Number(item.unit_price) * item.quantity)).toFixed(2)} ج.م
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        ({Number(item.unit_price || 0).toFixed(2)} ج.م / {item.pricing_unit || 'وحدة'})
                      </span>
                    </div>
                  </div>
                );
              })}
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
                <span>المجموع الفرعي للأصناف:</span>
                <span className="font-bold text-slate-800">{Number(order.subtotal || order.total_amount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>رسوم التوصيل:</span>
                <span className="font-bold text-slate-800">{Number(order.delivery_fee || 0).toFixed(2)} ج.م</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>الخصم المطبق:</span>
                  <span>- {Number(order.discount_amount).toFixed(2)} ج.م</span>
                </div>
              )}
              {Boolean(order.preauth_hold_amount && Number(order.preauth_hold_amount) > 0) && (
                <div className={`flex justify-between items-center text-xs font-bold p-2.5 rounded-xl border ${
                  order.is_weight_confirmed 
                    ? 'bg-slate-50 text-slate-500 border-slate-200' 
                    : 'bg-indigo-50/70 text-indigo-700 border-indigo-100'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Scale size={14} className={order.is_weight_confirmed ? 'text-slate-400' : 'text-indigo-600'} />
                    حجز مسبق للوزن المتغير (+15% Hold):
                  </span>
                  <span>
                    {order.is_weight_confirmed 
                      ? 'تم تحرير الحجز وتحصيل الفعلي فقط' 
                      : `+${Number(order.preauth_hold_amount).toFixed(2)} ج.م`}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <div>
                  <span className="font-black text-slate-900 block">المبلغ الإجمالي المستحق:</span>
                  {order.is_weight_confirmed ? (
                    <span className="text-[10px] text-emerald-600 font-bold">تم اعتماد المبلغ بعد وزن الأصناف</span>
                  ) : order.items?.some(it => it.is_weighted || it.requested_weight) ? (
                    <span className="text-[10px] text-amber-600 font-bold">المبلغ تقريبي لحين تأكيد الوزن الفعلي</span>
                  ) : null}
                </div>
                <span className="font-black text-primary text-base">
                  {Number(order.total_amount).toFixed(2)} ج.م
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
