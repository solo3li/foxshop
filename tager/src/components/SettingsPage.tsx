import React from 'react';
import { Store, Clock, Bike, ShieldCheck, Flame, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const SettingsPage: React.FC = () => {
  const { restaurant, toggleStoreBusy } = useAuthStore();

  if (!restaurant) {
    return (
      <div className="p-8 text-center text-slate-400">
        جاري تحميل إعدادات المتجر...
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <Store size={22} className="text-primary" />
          <span>إعدادات المتجر والمطبخ</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          إدارة حالة المطعم ومعلومات التشغيل المعتمدة في منصة فوكس شوب.
        </p>
      </div>

      {/* Store Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
            ) : (
              <Store size={32} className="text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">{restaurant.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{restaurant.description || 'مطعم معتمد في فوكس شوب'}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-50 text-primary border border-pink-200">
              كود المتجر: {restaurant.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Store Status Selector Card */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800">حالة المتجر واستقبال الطلبات</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              تحكم في فتح وإغلاق المتجر أو تفعيل وضع الذروة والضغط في المطبخ يدوياً في أي وقت.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => useAuthStore.getState().updateStoreStatus('OPEN')}
              className={`
                p-3 rounded-xl border text-right transition-all flex items-start gap-3
                ${(restaurant.status === 'OPEN' || (!restaurant.status && restaurant.is_active && !restaurant.is_busy))
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300'}
              `}
            >
              <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-xs text-slate-800 block">🟢 مفتوح للطلبات</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">يستقبل طلبات العملاء كالمعتاد</span>
              </div>
            </button>

            <button
              onClick={() => useAuthStore.getState().updateStoreStatus('BUSY')}
              className={`
                p-3 rounded-xl border text-right transition-all flex items-start gap-3
                ${(restaurant.status === 'BUSY' || (!restaurant.status && restaurant.is_active && restaurant.is_busy))
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300'}
              `}
            >
              <Flame size={20} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-xs text-slate-800 block">🟡 مشغول مؤقتاً</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">تنبيه العملاء باحتمال تأخر الطلبات</span>
              </div>
            </button>

            <button
              onClick={() => useAuthStore.getState().updateStoreStatus('CLOSED')}
              className={`
                p-3 rounded-xl border text-right transition-all flex items-start gap-3
                ${(restaurant.status === 'CLOSED' || (!restaurant.status && restaurant.is_active === false))
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300'}
              `}
            >
              <div className="w-5 h-5 rounded-full border-2 border-rose-500 flex items-center justify-center mt-0.5 shrink-0">
                <span className="w-2.5 h-0.5 bg-rose-500 rounded" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 block">🔴 مغلق حالياً</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">إيقاف استقبال طلبات جديدة فوراً</span>
              </div>
            </button>
          </div>
        </div>

        {/* Operating Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <Clock size={20} className="text-slate-400" />
            <div>
              <span className="font-bold text-slate-500 block">وقت التحضير المعتاد</span>
              <span className="font-black text-slate-800 text-sm mt-0.5 block">{restaurant.estimated_prep_time_minutes} دقيقة</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <Bike size={20} className="text-slate-400" />
            <div>
              <span className="font-bold text-slate-500 block">رسوم التوصيل الأساسية</span>
              <span className="font-black text-slate-800 text-sm mt-0.5 block">{restaurant.delivery_fee} ر.س</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-500" />
            <div>
              <span className="font-bold text-slate-500 block">حالة الحساب</span>
              <span className="font-black text-emerald-600 text-sm mt-0.5 block">موثق ونشط ✅</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
