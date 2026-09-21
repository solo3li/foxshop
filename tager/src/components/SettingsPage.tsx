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

        {/* Status Toggle Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800">حالة ضغط العمل في المطبخ</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              عند تفعيل وضع "مشغول"، يتم إعلام العميل باحتمالية تأخير الطلب وتطبيق تسعير الذروة لحماية جودة مطبخك.
            </p>
          </div>

          <button
            onClick={toggleStoreBusy}
            className={`
              px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0
              ${restaurant.is_busy 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700'}
            `}
          >
            {restaurant.is_busy ? (
              <>
                <Flame size={16} />
                <span>المطعم مشغول 🟡</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>مستعد واستقبال عادي 🟢</span>
              </>
            )}
          </button>
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
