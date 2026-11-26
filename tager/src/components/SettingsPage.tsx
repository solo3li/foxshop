import React, { useState } from 'react';
import { 
  Store, 
  Clock, 
  Bike, 
  ShieldCheck, 
  Flame, 
  CheckCircle2, 
  Truck, 
  Layers, 
  ShoppingBag, 
  Pill, 
  Beef, 
  Flower2, 
  Save 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

export const SettingsPage: React.FC = () => {
  const { restaurant, updateRestaurantInfo } = useAuthStore();
  const [storeType, setStoreType] = useState<string>(restaurant?.store_type || 'RESTAURANT');
  const [deliveryMode, setDeliveryMode] = useState<string>(restaurant?.delivery_mode || 'PLATFORM_MANAGED');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  if (!restaurant) {
    return (
      <div className="p-8 text-center text-slate-400">
        جاري تحميل إعدادات المتجر...
      </div>
    );
  }

  const handleSaveSettings = async () => {
    setIsSavingConfig(true);
    setConfigSuccess(false);
    const res = await api.updateRestaurantSettings(restaurant.id, {
      store_type: storeType,
      delivery_mode: deliveryMode,
    });
    if (res.data) {
      updateRestaurantInfo({
        store_type: res.data.store_type,
        delivery_mode: res.data.delivery_mode,
      });
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } else {
      alert(res.error || 'تعذر تحديث إعدادات المتجر');
    }
    setIsSavingConfig(false);
  };

  const storeTypesList = [
    { id: 'RESTAURANT', label: 'مطعم ومأكولات', icon: Store, desc: 'وجبات جاهزة، مطابخ سحابية، كافيهات' },
    { id: 'SUPERMARKET', label: 'سوبرماركت وبقالة', icon: ShoppingBag, desc: 'مواد غذائية وتموينات ومعلبات' },
    { id: 'PHARMACY', label: 'صيدلية ومستلزمات طبية', icon: Pill, desc: 'أدوية، عناية صحية، تجميل' },
    { id: 'BUTCHERY_VEG', label: 'ملحمة وخضروات طازجة', icon: Beef, desc: 'لحوم، دواجن، خضار وفواكه بالوزن' },
    { id: 'FLOWERS_GIFTS', label: 'زهور وهدايا', icon: Flower2, desc: 'باقات ورد، شوكولاتة، هدايا وتوزيعات' },
    { id: 'GENERAL_RETAIL', label: 'متاجر عامة وتجزئة', icon: Layers, desc: 'إلكترونيات، مستلزمات، ملابس' },
  ];

  const deliveryModesList = [
    {
      id: 'PLATFORM_MANAGED',
      label: 'كباتن منصة فوكس شوب (Platform Managed)',
      icon: Bike,
      desc: 'إسناد وتوجيه آلي لكباتن المنصة عبر نظام الرادار المباشر، ومتابعة كاملة من مشرفي التوصيل.',
      badge: 'توصيل المنصة الموصى به',
      badgeColor: 'bg-primary/10 text-primary border-primary/20'
    },
    {
      id: 'STORE_OWN_FLEET',
      label: 'أسطول المتجر الخاص (Store Own Fleet)',
      icon: Truck,
      desc: 'التوصيل يتم بالكامل بواسطة سائقي المتجر الخاصين. تحتسب المنصة العمولة النظامية فقط بدون إشراك كباتن المنصة.',
      badge: 'أسطول خاص',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
  ];

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <Store size={22} className="text-primary" />
          <span>إعدادات المتجر والتشغيل</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          إدارة حالة المتجر ومعلومات التشغيل ونموذج العمل المعتمد في منصة فوكس شوب.
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
            <p className="text-xs text-slate-400 mt-0.5">{restaurant.description || 'متجر معتمد في فوكس شوب'}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-50 text-primary border border-pink-200">
                كود المتجر: {restaurant.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                النشاط: {storeTypesList.find(s => s.id === (restaurant.store_type || 'RESTAURANT'))?.label || restaurant.store_type}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                الأسطول: {restaurant.delivery_mode === 'STORE_OWN_FLEET' ? 'أسطول المتجر' : 'كباتن المنصة'}
              </span>
            </div>
          </div>
        </div>

        {/* Store Status Selector Card */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800">حالة المتجر واستقبال الطلبات</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              تحكم في فتح وإغلاق المتجر أو تفعيل وضع الذروة وضغط التجهيز يدوياً في أي وقت.
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

        {/* Multi-Vertical Store Type Selection */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-primary" />
              <span>قطاع ونشاط المتجر (Multi-Vertical Stores)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              حدد التصنيف التجاري لمتجرك لتفعيل الخصائص المخصصة (مثل الأوزان المتغيرة للملاحم والخضار، أو أرقام الباركود للسوبرماركت).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storeTypesList.map((st) => {
              const IconComp = st.icon;
              const isSelected = storeType === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStoreType(st.id)}
                  className={`
                    p-3.5 rounded-xl border text-right transition-all flex items-start gap-3
                    ${isSelected 
                      ? 'bg-pink-50/60 border-primary ring-2 ring-primary/20 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'}
                  `}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    <IconComp size={18} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">{st.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">{st.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hybrid Fleet Delivery Mode Selection */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Truck size={18} className="text-indigo-600" />
              <span>نموذج التوصيل والأسطول (Hybrid Fleet)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              اختر ما إذا كان التوصيل يعتمد على كباتن منصة فوكس شوب أو يتم عبر أسطول المتجر الداخلي.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {deliveryModesList.map((dm) => {
              const IconComp = dm.icon;
              const isSelected = deliveryMode === dm.id;
              return (
                <button
                  key={dm.id}
                  type="button"
                  onClick={() => setDeliveryMode(dm.id)}
                  className={`
                    p-4 rounded-xl border text-right transition-all flex flex-col justify-between gap-3
                    ${isSelected 
                      ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">{dm.label}</span>
                      <span className="text-[11px] text-slate-500 block mt-1 leading-relaxed">{dm.desc}</span>
                    </div>
                  </div>
                  <span className={`inline-block self-start text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${dm.badgeColor}`}>
                    {dm.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Settings Action Bar */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <div>
            {configSuccess && (
              <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={16} />
                تم حفظ التعديلات بنجاح!
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSavingConfig}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-pink-700 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSavingConfig ? 'جاري الحفظ...' : 'حفظ إعدادات المتجر والأسطول'}</span>
          </button>
        </div>

        {/* Operating Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-4 border-t border-slate-100">
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
              <span className="font-black text-slate-800 text-sm mt-0.5 block">{restaurant.delivery_fee} ج.م</span>
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
