import React, { useState, useEffect } from 'react';
import { X, Printer, User, MapPin, Phone, CreditCard, Clock, CheckCircle2, Scale } from 'lucide-react';
import type { Order } from '../types';
import { api } from '../api/client';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, onOrderUpdated }) => {
  if (!order) return null;

  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [actualWeights, setActualWeights] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    order.items?.forEach((it) => {
      if (it.is_weighted || it.requested_weight) {
        init[it.id] = String(it.actual_weight || it.requested_weight || '');
      }
    });
    return init;
  });
  const [isUpdatingWeight, setIsUpdatingWeight] = useState(false);

  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      const init: Record<string, string> = {};
      order.items?.forEach((it) => {
        if (it.is_weighted || it.requested_weight) {
          init[it.id] = String(it.actual_weight || it.requested_weight || '');
        }
      });
      setActualWeights(init);
    }
  }, [order]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveWeights = async () => {
    const itemsToUpdate = Object.entries(actualWeights)
      .filter(([_, val]) => val && !isNaN(parseFloat(val)) && parseFloat(val) > 0)
      .map(([itemId, val]) => ({
        item_id: itemId,
        actual_weight: parseFloat(val),
      }));

    if (itemsToUpdate.length === 0) {
      alert('يرجى إدخال وزن صحيح للأصناف');
      return;
    }

    setIsUpdatingWeight(true);
    const res = await api.confirmOrderWeights(currentOrder.id, itemsToUpdate);
    if (res.data?.order) {
      setCurrentOrder(res.data.order);
      if (onOrderUpdated) onOrderUpdated(res.data.order);
      alert('تم تحديث وتأكيد الأوزان الفعلية بنجاح!');
    } else {
      alert(res.error || 'تعذر تأكيد الأوزان');
    }
    setIsUpdatingWeight(false);
  };

  const hasWeightedItems = currentOrder.items?.some(it => it.is_weighted || it.requested_weight);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-extrabold text-base text-slate-800">
              تفاصيل الطلب #{order.id.slice(0, 8).toUpperCase()}
            </h3>
            <span className="text-xs text-slate-500">
              تاريخ الطلب: {new Date(order.created_at).toLocaleString('ar-SA')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Customer & Delivery Details */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <User size={15} className="text-slate-400" />
              <span className="font-bold">اسم العميل:</span>
              <span>{currentOrder.customer_name}</span>
            </div>
            {currentOrder.customer_phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone size={15} className="text-slate-400" />
                <span className="font-bold">رقم الهاتف:</span>
                <span dir="ltr">{currentOrder.customer_phone}</span>
              </div>
            )}
            {currentOrder.delivery_address_display && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="font-bold">عنوان التوصيل:</span>
                <span>{currentOrder.delivery_address_display}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <CreditCard size={15} className="text-slate-400" />
              <span className="font-bold">طريقة الدفع:</span>
              <span>{currentOrder.payment_method === 'COD' ? 'الدفع نقداً عند الاستلام' : 'دفع إلكتروني / المحفظة'}</span>
            </div>
          </div>

          {/* Variable Weight Notice & Confirm */}
          {hasWeightedItems && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                  <Scale size={14} className="text-amber-600" />
                  أصناف بالوزن الفعلي
                </span>
                {currentOrder.is_weight_confirmed ? (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    معتمد ومحدث ✅
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveWeights}
                    disabled={isUpdatingWeight}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition-colors disabled:opacity-50"
                  >
                    {isUpdatingWeight ? 'جاري الحفظ...' : 'تأكيد الوزن الفعلي'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Items Breakdown Table */}
          <div>
            <h4 className="font-bold text-xs text-slate-500 mb-2">أصناف الفاتورة:</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {currentOrder.items && currentOrder.items.map((item, idx) => {
                const isWeighted = Boolean(item.is_weighted || item.requested_weight);
                return (
                  <div key={idx} className="p-3 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-extrabold text-primary">{item.quantity}×</span>
                        <div>
                          <span className="font-bold text-slate-800">{item.item_name || item.menu_item_name}</span>
                          {item.special_instructions && (
                            <span className="block text-amber-600 text-[11px] font-semibold">
                              ملاحظة: {item.special_instructions}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-800">
                        {item.total_price || item.unit_price * item.quantity} ج.م
                      </span>
                    </div>

                    {isWeighted && (
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-[11px]">
                        <span className="text-slate-500 font-bold">المطلوب: {item.requested_weight ?? item.quantity} {item.pricing_unit || 'كجم'}</span>
                        <div className="flex items-center gap-1 mr-auto">
                          <label className="font-black text-slate-700">الفعلي:</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={actualWeights[item.id] ?? ''}
                            onChange={(e) => setActualWeights({
                              ...actualWeights,
                              [item.id]: e.target.value
                            })}
                            className="w-20 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-center"
                            placeholder="0.00"
                          />
                          <span className="text-slate-500">{item.pricing_unit || 'كجم'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-bold">{currentOrder.subtotal || currentOrder.total_amount} ج.م</span>
            </div>
            {currentOrder.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>الخصم / الكوبون:</span>
                <span>-{currentOrder.discount_amount} ج.م</span>
              </div>
            )}
            {Boolean(currentOrder.preauth_hold_amount && Number(currentOrder.preauth_hold_amount) > 0) && (
              <div className={`flex justify-between text-xs font-bold p-2 rounded-lg border ${
                currentOrder.is_weight_confirmed 
                  ? 'bg-slate-100 text-slate-500 border-slate-200' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}>
                <span>حجز مسبق للوزن المتغير (+15% Hold):</span>
                <span>
                  {currentOrder.is_weight_confirmed 
                    ? 'تم تحرير الحجز وتحصيل الفعلي' 
                    : `+${Number(currentOrder.preauth_hold_amount).toFixed(2)} ج.م`}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>المجموع النهائي:</span>
              <span className="text-primary text-base">{currentOrder.total_amount} ج.م</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Printer size={15} />
            <span>طباعة الفاتورة</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
