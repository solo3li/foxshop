import React from 'react';
import { DollarSign, ShoppingBag, Clock, TrendingUp, Award, Flame } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { useAuthStore } from '../store/authStore';

export const AnalyticsDashboard: React.FC = () => {
  const orders = useOrderStore(state => state.orders);
  const restaurant = useAuthStore(state => state.restaurant);

  // Compute metrics
  const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);
  const completedOrders = orders.filter(o => o.status === 'DELIVERED' || o.status === 'READY_FOR_PICKUP').length;
  const activeOrders = orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING').length;
  const avgPrepTime = restaurant?.estimated_prep_time_minutes || 25;

  const stats = [
    {
      title: 'مبيعات اليوم الإجمالية',
      value: `${totalRevenue.toFixed(2)} ر.س`,
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      trend: '+12% مقارنة بأمس',
    },
    {
      title: 'إجمالي الطلبات المستلمة',
      value: orders.length,
      icon: ShoppingBag,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      trend: `${completedOrders} طلب مكتمل`,
    },
    {
      title: 'طلبات قيد المعالجة الآن',
      value: activeOrders,
      icon: Flame,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      trend: 'في المطبخ حالياً',
    },
    {
      title: 'متوسط وقت التحضير',
      value: `${avgPrepTime} دقيقة`,
      icon: Clock,
      color: 'bg-pink-50 text-primary border-pink-200',
      trend: 'السرعة القياسية للمطعم',
    },
  ];

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <TrendingUp size={22} className="text-primary" />
          <span>لوحة تقارير المبيعات والأداء</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          نظرة عامة على نشاط مطعمك وسرعة التحضير لهذا اليوم.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{s.title}</span>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.color}`}>
                  <Icon size={20} />
                </div>
              </div>

              <div>
                <span className="text-2xl font-black text-slate-800">{s.value}</span>
                <p className="text-xs text-slate-400 font-medium mt-1">{s.trend}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance Summary Banner */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-right">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Award size={22} className="text-amber-300" />
            <h3 className="text-lg font-black">تقييم المتجر: {restaurant?.rating || '4.8'} ⭐</h3>
          </div>
          <p className="text-xs text-pink-100 max-w-md">
            أداؤك ممتاز! الحفاظ على وقت تحضير أقل من 20 دقيقة يرفع ترتيب مطعمك في الصفحة الرئيسية للعملاء بنسبة 35%.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs px-5 py-3 rounded-xl border border-white/20 text-center">
          <span className="text-xs font-bold block text-pink-100">ساعات الذروة المعتادة</span>
          <span className="text-sm font-black mt-0.5 block">1:00 م - 4:00 م | 8:00 م - 11:00 م</span>
        </div>
      </div>
    </div>
  );
};
