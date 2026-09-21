import React from 'react';
import { X, Printer, User, MapPin, Phone, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import type { Order } from '../types';

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

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
              <span>{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone size={15} className="text-slate-400" />
                <span className="font-bold">رقم الهاتف:</span>
                <span dir="ltr">{order.customer_phone}</span>
              </div>
            )}
            {order.delivery_address_display && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="font-bold">عنوان التوصيل:</span>
                <span>{order.delivery_address_display}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <CreditCard size={15} className="text-slate-400" />
              <span className="font-bold">طريقة الدفع:</span>
              <span>{order.payment_method === 'CASH' ? 'الدفع نقداً عند الاستلام' : 'دفع إلكتروني / المحفظة'}</span>
            </div>
          </div>

          {/* Items Breakdown Table */}
          <div>
            <h4 className="font-bold text-xs text-slate-500 mb-2">أصناف الفاتورة:</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {order.items && order.items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-extrabold text-primary">{item.quantity}×</span>
                    <div>
                      <span className="font-bold text-slate-800">{item.menu_item_name}</span>
                      {item.special_instructions && (
                        <span className="block text-amber-600 text-[11px] font-semibold">
                          ملاحظة: {item.special_instructions}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-800">
                    {item.total_price || item.unit_price * item.quantity} ر.س
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-bold">{order.subtotal || order.total_amount} ر.س</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>الخصم / الكوبون:</span>
                <span>-{order.discount_amount} ر.س</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>المجموع النهائي:</span>
              <span className="text-primary text-base">{order.total_amount} ر.س</span>
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
