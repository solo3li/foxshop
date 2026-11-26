import React, { useEffect, useState } from 'react';
import { 
  Receipt, 
  DollarSign, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Bike, 
  Phone, 
  AlertCircle, 
  ShieldCheck, 
  WalletCards,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api/client';
import type { ShiftSettlement, UnsettledDriver } from '../types';

export const DriverSettlementsView: React.FC = () => {
  const [settlements, setSettlements] = useState<ShiftSettlement[]>([]);
  const [unsettledDrivers, setUnsettledDrivers] = useState<UnsettledDriver[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<ShiftSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingOtp, setIsGeneratingOtp] = useState<string | null>(null);
  const [activeGeneratedOtps, setActiveGeneratedOtps] = useState<Record<string, ShiftSettlement>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [listRes, pendingRes] = await Promise.all([
        api.getSettlements(),
        api.getPendingSettlements()
      ]);

      if (listRes.data) {
        setSettlements(listRes.data.settlements || []);
        setUnsettledDrivers(listRes.data.unsettled_drivers || []);
      }
      if (pendingRes.data) {
        setPendingSettlements(pendingRes.data || []);
        // Map pending settlements with OTP by driver ID
        const map: Record<string, ShiftSettlement> = {};
        pendingRes.data.forEach((s) => {
          const key = (s as any).driver_id || s.driver;
          if (key) map[key] = s;
        });
        setActiveGeneratedOtps(prev => ({ ...prev, ...map }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تحميل بيانات التسويات');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateOtp = async (driverId: string) => {
    setIsGeneratingOtp(driverId);
    setErrorMessage(null);
    const res = await api.createSettlementOTP(driverId);
    if (res.data?.settlement) {
      setActiveGeneratedOtps(prev => ({
        ...prev,
        [driverId]: res.data!.settlement
      }));
      await loadData();
    } else {
      setErrorMessage(res.error || 'تعذر إنشاء رمز التسوية للكابتن');
    }
    setIsGeneratingOtp(null);
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Receipt size={24} className="text-primary" />
            <span>تسوية شفتات الكباتن النقدية (Driver Cash Settlement)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استلام مبالغ الطلبات النقدية (COD) من الكباتن بنسبة 100% وإخلاء العهدة عبر رمز التحقق (OTP).
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Rules & Transparency Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={22} className="text-emerald-400" />
          <h3 className="font-extrabold text-sm">قواعد تسوية الكاش المباشرة مع الكباتن</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="font-bold text-white mb-1">1. استلام 100% من قيمة البضاعة</p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              يقوم الكابتن بتوريد كامل قيمة الطلبات النقدية للمتجر نقداً بدون خصم عمولة المنصة.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="font-bold text-white mb-1">2. خصم العمولة آلياً من المحفظة</p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              تُخصم عمولة المنصة تلقائياً من محفظة المتجر الرقمية فور تأكيد الكابتن لرمز التسوية.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="font-bold text-white mb-1">3. تسليم رمز الـ OTP بعد استلام النقد</p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              لا تعطي رمز الـ OTP المكون من 6 أرقام للكابتن إلا بعد عد واستلام المبلغ كاملاً بيدك.
            </p>
          </div>
        </div>
      </div>

      {/* Unsettled Drivers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Bike size={18} className="text-primary" />
            <span>كباتن بانتظار تسوية العهدة النقدية ({unsettledDrivers.length})</span>
          </h3>
        </div>

        {unsettledDrivers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 shadow-xs">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h4 className="font-extrabold text-slate-800 text-sm">جميع الشفتات مسواة بالكامل!</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              لا توجد مبالغ نقدية معلقة في ذمة أي كابتن لطلبات تم تسليمها حالياً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unsettledDrivers.map((ud) => {
              const activeSettlement = activeGeneratedOtps[ud.driver_id];
              return (
                <div 
                  key={ud.driver_id} 
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 transition-all hover:border-slate-300"
                >
                  {/* Driver Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 text-primary flex items-center justify-center font-black">
                        <Bike size={20} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{ud.driver_name}</h4>
                        {ud.phone_number && (
                          <a 
                            href={`tel:${ud.phone_number}`}
                            dir="ltr"
                            className="text-[11px] font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Phone size={11} />
                            {ud.phone_number}
                          </a>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                      {ud.orders_count} طلبات كاش
                    </span>
                  </div>

                  {/* Financial Amount */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block">المبلغ المستحق استلامه نقدياً:</span>
                      <span className="text-xl font-black text-slate-900 mt-0.5 block">
                        {Number(ud.total_goods_amount).toFixed(2)} <small className="text-xs font-bold text-slate-600">ج.م</small>
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-400 block">قيمة البضاعة (100%)</span>
                      <span className="text-[10px] font-bold text-emerald-600">بدون خصم عمولة</span>
                    </div>
                  </div>

                  {/* OTP Generation / Display Area */}
                  {activeSettlement && activeSettlement.status === 'PENDING' ? (
                    <div className="p-4 rounded-xl bg-emerald-50/80 border-2 border-emerald-300 text-center space-y-2">
                      <span className="text-[11px] font-extrabold text-emerald-800 flex items-center justify-center gap-1.5">
                        <KeyRound size={15} />
                        رمز تسوية الشفت (OTP) المعطى للكابتن:
                      </span>
                      <div className="text-3xl font-black font-mono tracking-widest text-emerald-900 py-1 bg-white rounded-lg border border-emerald-200 shadow-xs inline-block px-6">
                        {activeSettlement.otp_code}
                      </div>
                      <p className="text-[10px] font-bold text-emerald-700">
                        أعطِ هذا الكود للكابتن ليدخله في شاشة المحفظة بتطبيقه بعد استلامك {Number(activeSettlement.total_goods_amount).toFixed(2)} ج.م نقداً.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleGenerateOtp(ud.driver_id)}
                        disabled={isGeneratingOtp === ud.driver_id}
                        className="mt-1 text-[11px] text-slate-500 hover:text-primary font-bold underline cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingOtp === ud.driver_id ? 'جاري التحديث...' : 'توليد رمز جديد / تحديث'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerateOtp(ud.driver_id)}
                      disabled={isGeneratingOtp === ud.driver_id}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound size={15} />
                      <span>{isGeneratingOtp === ud.driver_id ? 'جاري إنشاء الرمز...' : 'إنشاء رمز التسوية النقدية (OTP)'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Settlements Archive Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Clock size={16} className="text-slate-500" />
              <span>سجل التسويات النقدية السابقة ({settlements.length})</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              أرشيف العمليات التي تمت بنجاح بين المتجر وكباتن التوصيل.
            </p>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            لا توجد تسويات نقدية سابقة مسجلة حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-bold">رقم العملية</th>
                  <th className="py-2.5 px-3 font-bold">الكابتن</th>
                  <th className="py-2.5 px-3 font-bold">عدد الطلبات</th>
                  <th className="py-2.5 px-3 font-bold">المبلغ المستلم (100%)</th>
                  <th className="py-2.5 px-3 font-bold">عمولة المنصة المخصومة</th>
                  <th className="py-2.5 px-3 font-bold">الحالة</th>
                  <th className="py-2.5 px-3 font-bold">التاريخ والتوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      #{st.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-slate-900 block">{st.driver_name || 'كابتن'}</span>
                      {st.driver_phone && <span className="text-[10px] text-slate-400 font-mono">{st.driver_phone}</span>}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-700">
                      {st.orders_count} طلبات
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900">
                      {Number(st.total_goods_amount).toFixed(2)} ج.م
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-600">
                      - {Number(st.platform_commission_amount).toFixed(2)} ج.م
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        st.status === 'COMPLETED' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {st.status === 'COMPLETED' ? 'مكتملة ومسواة ✅' : 'بانتظار التحقق ⏳'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(st.settled_at || st.created_at).toLocaleString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};