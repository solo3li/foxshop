import React, { useState } from 'react';
import {
  Send,
  UserCheck,
  Clock,
  MapPin,
  Store,
  Phone,
  AlertCircle,
  CheckCircle2,
  Bike,
  Car,
  X,
  Zap,
  Radio,
  ExternalLink,
  RotateCw
} from 'lucide-react';
import { SECTOR_OPTIONS } from '../types';
import type { LiveOrderItem, DriverRadarItem } from '../types';

interface DispatchBoardProps {
  orders: LiveOrderItem[];
  drivers: DriverRadarItem[];
  onAssignOrder: (data: {
    order_id: string;
    driver_id?: string;
    driver_ids?: string[];
    mode: 'offer' | 'direct';
    timeout_seconds?: number;
  }) => Promise<{ success: boolean; message: string }>;
  onRefresh: () => void;
}

export const DispatchBoard: React.FC<DispatchBoardProps> = ({
  orders,
  drivers,
  onAssignOrder,
  onRefresh,
}) => {
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<LiveOrderItem | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [dispatchMode, setDispatchMode] = useState<'direct' | 'offer'>('direct');
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Available drivers (online drivers first)
  const availableDrivers = drivers
    .filter((d) => d.is_active)
    .sort((a, b) => {
      if (a.is_online && !a.is_busy && (!b.is_online || b.is_busy)) return -1;
      if (b.is_online && !b.is_busy && (!a.is_online || a.is_busy)) return 1;
      return a.cash_in_hand - b.cash_in_hand;
    });

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (unassignedOnly && order.has_assigned_driver) return false;
    if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
    if (sectorFilter !== 'ALL') {
      const orderSector = order.restaurant?.store_type || 'RESTAURANT';
      if (orderSector !== sectorFilter) return false;
    }
    return true;
  });

  const openAssignModal = (order: LiveOrderItem) => {
    setSelectedOrder(order);
    // Auto-select first online non-busy driver if available
    const firstFree = availableDrivers.find((d) => d.is_online && !d.is_busy && !d.is_over_limit);
    setSelectedDriverId(firstFree ? firstFree.id : availableDrivers[0]?.id || '');
    setActionMessage(null);
  };

  const closeAssignModal = () => {
    setSelectedOrder(null);
    setSelectedDriverId('');
    setActionMessage(null);
  };

  const handleExecuteDispatch = async () => {
    if (!selectedOrder || !selectedDriverId) return;

    setIsSubmitting(true);
    setActionMessage(null);

    const res = await onAssignOrder({
      order_id: selectedOrder.id,
      driver_id: selectedDriverId,
      mode: dispatchMode,
      timeout_seconds: timeoutSeconds,
    });

    setIsSubmitting(false);

    if (res.success) {
      setActionMessage({ text: res.message, type: 'success' });
      setTimeout(() => {
        closeAssignModal();
        onRefresh();
      }, 1200);
    } else {
      setActionMessage({ text: res.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      {/* 6-Sector Filtering Toolbar across the top */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800">تصفية قطاعات المتاجر:</span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">عرض وإدارة طلبات القطاعات الستة (المطاعم، السوبرماركت، الصيدليات، اللحوم، الزهور، والتجزئة)</span>
          </div>
          {sectorFilter !== 'ALL' && (
            <button
              onClick={() => setSectorFilter('ALL')}
              className="text-xs text-primary hover:text-primary-dark font-bold underline cursor-pointer"
            >
              عرض جميع القطاعات
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {SECTOR_OPTIONS.map((sec) => {
            const count = sec.id === 'ALL'
              ? orders.length
              : orders.filter((o) => (o.restaurant?.store_type || 'RESTAURANT') === sec.id).length;
            const isSelected = sectorFilter === sec.id;

            return (
              <button
                key={sec.id}
                onClick={() => setSectorFilter(sec.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-sm">{sec.emoji}</span>
                <span>{sec.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setStatusFilter('ALL');
              setUnassignedOnly(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'ALL' && !unassignedOnly
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            جميع الطلبات ({orders.length})
          </button>

          <button
            onClick={() => setUnassignedOnly(!unassignedOnly)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              unassignedOnly
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>بانتظار كابتن ({orders.filter((o) => o.needs_driver).length})</span>
          </button>

          <button
            onClick={() => {
              setStatusFilter('PREPARING');
              setUnassignedOnly(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'PREPARING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            قيد التجهيز ({orders.filter((o) => o.status === 'PREPARING').length})
          </button>

          <button
            onClick={() => {
              setStatusFilter('READY_FOR_PICKUP');
              setUnassignedOnly(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'READY_FOR_PICKUP'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            جاهز للاستلام ({orders.filter((o) => o.status === 'READY_FOR_PICKUP').length})
          </button>

          <button
            onClick={() => {
              setStatusFilter('ON_THE_WAY');
              setUnassignedOnly(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'ON_THE_WAY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            في الطريق ({orders.filter((o) => o.status === 'ON_THE_WAY').length})
          </button>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span>الكباتن الجاهزون للتكليف:</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            {availableDrivers.filter((d) => d.is_online && !d.is_busy).length} كابتن متاح
          </span>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-70" />
            <h4 className="text-base font-extrabold text-slate-900 mb-1">لا توجد طلبات جارية</h4>
            <p className="text-xs text-slate-500">جميع الطلبات معينة ومحدثة بشكل سليم</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isUnassigned = order.needs_driver;
            const isLongWait = order.elapsed_minutes > 15;
            const sectorMeta = SECTOR_OPTIONS.find((s) => s.id === (order.restaurant?.store_type || 'RESTAURANT')) || SECTOR_OPTIONS[1];

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition hover:shadow-md ${
                  isUnassigned
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-slate-900">#{order.order_number}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          order.status === 'CONFIRMED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : order.status === 'PREPARING'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : order.status === 'READY_FOR_PICKUP'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : order.status === 'ON_THE_WAY'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {order.status_display}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg border ${
                        isLongWait
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{order.elapsed_minutes} دقيقة</span>
                    </div>
                  </div>

                  {/* Locations: Store -> Customer */}
                  <div className="space-y-2 mb-4 text-xs">
                    {/* Store */}
                    <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <Store className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">{order.restaurant.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${sectorMeta.badgeClass}`}>
                            <span>{sectorMeta.emoji}</span>
                            <span>{sectorMeta.label}</span>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{order.restaurant.address}</div>
                      </div>
                      {order.restaurant.phone && (
                        <a
                          href={`tel:${order.restaurant.phone}`}
                          className="p-1 rounded-lg hover:bg-slate-200 text-sky-700 shrink-0"
                          title="اتصال بالمتجر"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Customer */}
                    <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {order.delivery_address.text}
                        </div>
                      </div>
                      {order.customer.phone && (
                        <a
                          href={`tel:${order.customer.phone}`}
                          className="p-1 rounded-lg hover:bg-slate-200 text-sky-700 shrink-0"
                          title="اتصال بالعميل"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Financials & OTP Info */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-slate-500">القيمة: </span>
                      <strong className="text-slate-900">{order.total_amount} ج.م</strong>
                      <span className="text-[10px] text-slate-500 mr-1">({order.payment_method_display})</span>
                    </div>
                    {order.trip?.delivery_otp && (
                      <div className="bg-primary-50 border border-primary-200 px-2 py-0.5 rounded text-[11px] font-mono text-primary font-bold">
                        OTP: {order.trip.delivery_otp}
                      </div>
                    )}
                  </div>

                  {/* Assigned Driver / Pending Offers Badge */}
                  <div className="mb-4">
                    {order.assigned_driver ? (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <div>
                            <div className="text-xs font-bold text-emerald-900">
                              الكابتن: {order.assigned_driver.name}
                            </div>
                            <div className="text-[10px] text-emerald-700">
                              {order.assigned_driver.vehicle_type_display} • {order.assigned_driver.phone_number}
                            </div>
                          </div>
                        </div>
                        {order.assigned_driver.phone_number && (
                          <a
                            href={`tel:${order.assigned_driver.phone_number}`}
                            className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ) : order.pending_offers_count > 0 ? (
                      <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-amber-600 animate-spin" />
                          <span className="font-semibold">مرسل لـ {order.pending_offers_count} كابتن (بانتظار الرد)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>الطلب يحتاج تعيين كابتن فوراً!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispatch Button */}
                <button
                  onClick={() => openAssignModal(order)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                    isUnassigned
                      ? 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isUnassigned ? 'تعيين كابتن يدوي فوراً' : 'إعادة توجيه / تغيير الكابتن'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Dispatch Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span>توجيه وتعيين كابتن للطلب #{selectedOrder.order_number}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedOrder.restaurant.name} ← {selectedOrder.customer.name}
                </p>
              </div>
              <button
                onClick={closeAssignModal}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Dispatch Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">طريقة التعيين:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('direct')}
                    className={`p-3 rounded-2xl border text-right transition flex items-start gap-2.5 ${
                      dispatchMode === 'direct'
                        ? 'border-primary bg-primary-50 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Zap className={`w-4 h-4 mt-0.5 ${dispatchMode === 'direct' ? 'text-primary' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">تعيين مباشر وإلزامي</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        يتم تعيين الكابتن فوراً وتكليفه بالطلب مباشرة
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatchMode('offer')}
                    className={`p-3 rounded-2xl border text-right transition flex items-start gap-2.5 ${
                      dispatchMode === 'offer'
                        ? 'border-primary bg-primary-50 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Radio className={`w-4 h-4 mt-0.5 ${dispatchMode === 'offer' ? 'text-primary' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">إرسال عرض مع مهلة</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        يصل العرض لتطبيق الكابتن مع عداد زمني للقبول
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Driver Selection List */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اختر الكابتن المطلوب ({availableDrivers.length} كابتن مسجل):
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableDrivers.map((driver) => {
                    const isSelected = selectedDriverId === driver.id;
                    return (
                      <div
                        key={driver.id}
                        onClick={() => setSelectedDriverId(driver.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary-50 border-primary text-slate-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              driver.is_online && !driver.is_busy
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : driver.is_busy
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {driver.vehicle_type === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-2">
                              <span>{driver.name}</span>
                              {driver.is_online && !driver.is_busy ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> متاح
                                </span>
                              ) : driver.is_busy ? (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> مشغول
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                  أوفلاين
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {driver.phone_number} • {driver.vehicle_type_display}
                            </div>
                          </div>
                        </div>

                        <div className="text-left">
                          <div
                            className={`text-xs font-extrabold ${
                              driver.is_over_limit ? 'text-rose-600' : 'text-slate-800'
                            }`}
                          >
                            {driver.cash_in_hand} ج.م
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {driver.is_over_limit ? 'مديونية مرتفعة' : 'كاش بيده'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Alert */}
              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    actionMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={closeAssignModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteDispatch}
                disabled={!selectedDriverId || isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark disabled:opacity-50 text-white transition flex items-center gap-2 shadow-sm shadow-primary/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'جاري الإرسال...' : 'تأكيد وإرسال التكليف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
