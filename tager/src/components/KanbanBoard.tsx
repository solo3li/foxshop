import React, { useState } from 'react';
import { ChefHat, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Order } from '../types';
import { OrderCard } from './OrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';

interface KanbanBoardProps {
  orders: Order[];
  onNavigateToSupport?: () => void;
  onSelectOrder?: (orderId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ orders, onNavigateToSupport, onSelectOrder }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mobileTab, setMobileTab] = useState<'new' | 'preparing' | 'ready'>('new');

  // Filter orders by status
  const newOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PENDING');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP');

  const columns = [
    {
      id: 'new' as const,
      title: 'طلبات جديدة',
      icon: AlertCircle,
      badgeColor: 'bg-pink-100 text-primary border-pink-200',
      headerBorder: 'border-primary',
      orders: newOrders,
    },
    {
      id: 'preparing' as const,
      title: 'قيد التحضير',
      icon: ChefHat,
      badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
      headerBorder: 'border-amber-500',
      orders: preparingOrders,
    },
    {
      id: 'ready' as const,
      title: 'جاهز للاستلام',
      icon: CheckCircle2,
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      headerBorder: 'border-emerald-500',
      orders: readyOrders,
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Mobile Status Switcher Tabs */}
      <div className="flex items-center gap-2 mb-4 md:hidden">
        {columns.map(col => (
          <button
            key={col.id}
            onClick={() => setMobileTab(col.id)}
            className={`
              flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border
              ${mobileTab === col.id 
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
            `}
          >
            <span>{col.title}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-extrabold ${col.badgeColor}`}>
              {col.orders.length}
            </span>
          </button>
        ))}
      </div>

      {/* Kanban Columns Grid (Desktop: 3 columns, Mobile: Active Tab) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-y-auto md:overflow-hidden">
        {columns.map(col => {
          const Icon = col.icon;
          const isVisibleOnMobile = mobileTab === col.id;

          return (
            <div
              key={col.id}
              className={`
                bg-slate-100/70 rounded-2xl border border-slate-200/80 flex flex-col overflow-hidden max-h-full
                ${!isVisibleOnMobile ? 'hidden md:flex' : 'flex'}
              `}
            >
              {/* Column Header */}
              <div className={`p-4 border-b-2 bg-white flex items-center justify-between ${col.headerBorder}`}>
                <div className="flex items-center gap-2">
                  <Icon size={18} className="text-slate-600" />
                  <h3 className="font-extrabold text-sm text-slate-800">{col.title}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${col.badgeColor}`}>
                  {col.orders.length} طلب
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-3.5 space-y-3.5 overflow-y-auto">
                {col.orders.length > 0 ? (
                  col.orders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onViewDetails={(ord) => onSelectOrder ? onSelectOrder(ord.id) : setSelectedOrder(ord)}
                      onNavigateToSupport={onNavigateToSupport}
                    />
                  ))
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400">
                    <span className="text-3xl mb-2">✨</span>
                    <p className="font-bold text-xs">لا توجد طلبات في هذا العمود حالياً</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Order Invoice Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
