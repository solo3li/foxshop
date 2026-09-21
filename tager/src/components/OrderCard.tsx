import React from 'react';
import { 
  Clock, 
  User, 
  MapPin, 
  Phone, 
  Check, 
  X, 
  ChefHat, 
  Bike, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import type { Order } from '../types';
import { useOrderStore } from '../store/orderStore';

interface OrderCardProps {
  order: Order;
  onViewDetails: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onViewDetails }) => {
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Time elapsed since order creation
  const getElapsedMinutes = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const elapsed = getElapsedMinutes(order.created_at);

  const handleAction = async (newStatus: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED') => {
    setIsUpdating(true);
    await updateOrderStatus(order.id, newStatus);
    setIsUpdating(false);
  };

  const isUrgent = elapsed > 15 && order.status !== 'READY_FOR_PICKUP';

  return (
    <div 
      className={`
        bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between gap-3
        ${order.status === 'CONFIRMED' || order.status === 'PENDING' ? 'border-pink-300 ring-2 ring-pink-100' : 'border-slate-200'}
        ${isUrgent ? 'border-amber-400 bg-amber-50/20' : ''}
      `}
    >
      {/* Top Header: Order ID + Timer + Price */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-slate-800 tracking-wider">
              #{order.id.slice(0, 6).toUpperCase()}
            </span>
            {order.pickup_code && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
                كود: {order.pickup_code}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
            <Clock size={13} className={isUrgent ? 'text-amber-500 animate-spin' : 'text-slate-400'} />
            <span className={isUrgent ? 'text-amber-600 font-extrabold' : ''}>
              منذ {elapsed} د
            </span>
          </div>
        </div>

        {/* Customer & Address Preview */}
        <div className="pt-2.5 pb-2 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <User size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{order.customer_name || 'عميل فوكس شوب'}</span>
            {order.customer_phone && (
              <span className="text-slate-400 font-normal">({order.customer_phone})</span>
            )}
          </div>

          {order.notes && (
            <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-1.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="font-bold">ملاحظة: {order.notes}</span>
            </div>
          )}
        </div>

        {/* Items List Breakdown */}
        <div className="py-2 space-y-1.5 my-1 border-t border-b border-slate-50">
          {order.items && order.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between text-xs gap-2">
              <div className="flex items-start gap-1.5 flex-1">
                <span className="font-extrabold text-primary min-w-[20px] text-left">
                  {item.quantity}×
                </span>
                <div className="flex-1 font-semibold text-slate-800">
                  <span>{item.menu_item_name}</span>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <span className="text-slate-400 block text-[11px] font-normal">
                      + {item.modifiers.map(m => m.name).join('، ')}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-bold text-slate-700 shrink-0">
                {item.total_price || item.unit_price * item.quantity} ر.س
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Price + Action Button */}
      <div className="pt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>الإجمالي المطلوب:</span>
          <span className="text-sm font-extrabold text-primary">
            {order.total_amount} ر.س
          </span>
        </div>

        {/* Dynamic Action Buttons according to KDS Column */}
        <div className="flex items-center gap-2 pt-1">
          {order.status === 'CONFIRMED' || order.status === 'PENDING' ? (
            <>
              <button
                onClick={() => handleAction('PREPARING')}
                disabled={isUpdating}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <ChefHat size={15} />
                <span>قبول وبدء التحضير</span>
              </button>
              <button
                onClick={() => handleAction('CANCELLED')}
                disabled={isUpdating}
                className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                title="إلغاء الطلب"
              >
                <X size={15} />
              </button>
            </>
          ) : order.status === 'PREPARING' ? (
            <button
              onClick={() => handleAction('READY_FOR_PICKUP')}
              disabled={isUpdating}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Check size={15} />
              <span>جاهز للاستلام والتسليم</span>
            </button>
          ) : (
            <div className="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-center font-bold text-xs flex items-center justify-center gap-1.5">
              <Bike size={15} className="text-slate-500 animate-bounce" />
              <span>بانتظار وصول الكابتن</span>
            </div>
          )}

          {/* Details Modal Trigger */}
          <button
            onClick={() => onViewDetails(order)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="تفاصيل الفاتورة الكاملة"
          >
            <FileText size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
