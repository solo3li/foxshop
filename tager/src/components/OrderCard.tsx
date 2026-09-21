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
import { OrderEmergencyModal } from './OrderEmergencyModal';

interface OrderCardProps {
  order: Order;
  onViewDetails: (order: Order) => void;
  onNavigateToSupport?: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onViewDetails, onNavigateToSupport }) => {
  const updateOrderStatus = useOrderStore(state => state.updateOrderStatus);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = React.useState(false);

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
    <>
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

          {/* Customer & Location */}
          <div className="py-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                <User size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{order.customer_name}</span>
              </span>
              <span className="font-extrabold text-primary shrink-0">
                {order.total_amount} ر.س
              </span>
            </div>

            {order.delivery_address_display && (
              <div className="text-slate-500 flex items-center gap-1.5 text-[11px] truncate">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{order.delivery_address_display}</span>
              </div>
            )}
          </div>

          {/* Items Summary List */}
          <div className="py-2 border-t border-slate-100 space-y-1">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-start justify-between text-xs text-slate-700">
                <span className="truncate font-semibold">
                  <strong className="text-primary font-black ml-1">x{item.quantity}</strong>
                  {item.menu_item_name}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <span className="text-[11px] text-slate-400 font-bold block pt-0.5">
                +{order.items.length - 3} أصناف إضافية...
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          {order.status === 'CONFIRMED' || order.status === 'PENDING' ? (
            <>
              <button
                onClick={() => handleAction('PREPARING')}
                disabled={isUpdating}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary hover:bg-pink-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <ChefHat size={15} />
                <span>قبول وبدء التحضير</span>
              </button>
              <button
                onClick={() => handleAction('CANCELLED')}
                disabled={isUpdating}
                className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
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
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
            title="تفاصيل الفاتورة الكاملة"
          >
            <FileText size={16} />
          </button>

          {/* Emergency SOS Support Button */}
          <button
            onClick={() => setIsEmergencyOpen(true)}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200 shrink-0"
            title="طوارئ ومساعدة في هذا الطلب"
          >
            <AlertTriangle size={16} />
          </button>
        </div>
      </div>

      {/* Emergency Modal */}
      <OrderEmergencyModal
        order={order}
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        onOpenTicket={() => {
          if (onNavigateToSupport) onNavigateToSupport();
        }}
      />
    </>
  );
};
