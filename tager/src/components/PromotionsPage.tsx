import React, { useEffect, useState } from 'react';
import { 
  Tag, 
  Percent, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Users, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  Truck,
  DollarSign,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  X
} from 'lucide-react';
import { api } from '../api/client';
import type { Coupon } from '../types';

export const PromotionsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for new coupon
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'PERCENT' as 'PERCENT' | 'FLAT' | 'FREE_DELIVERY',
    discount_value: '15',
    min_order_amount: '30',
    max_discount_amount: '30',
    first_order_only: false,
    valid_days: '30',
    max_usage_per_user: '1',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCoupons = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getCoupons();
      if (res.data) {
        setCoupons(res.data);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تحميل قائمة الكوبونات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleToggle = async (coupon: Coupon) => {
    try {
      const res = await api.toggleCoupon(coupon.id);
      if (res.data) {
        setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: res.data!.is_active } : c));
        setSuccessMessage(res.data.message);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تعديل حالة الكوبون');
    }
  };

  const copyToClipboard = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = formData.code.trim().toUpperCase();
    if (!code) {
      setFormError('يرجى إدخال كود الكوبون');
      return;
    }

    const discountValue = parseFloat(formData.discount_value);
    if (isNaN(discountValue) || discountValue < 0) {
      setFormError('يرجى إدخال قيمة خصم صحيحة');
      return;
    }

    if (formData.discount_type === 'PERCENT' && (discountValue <= 0 || discountValue > 100)) {
      setFormError('نسبة الخصم يجب أن تكون بين 1% و 100%');
      return;
    }

    const minOrder = parseFloat(formData.min_order_amount) || 0;
    const maxDiscount = formData.discount_type === 'PERCENT' && formData.max_discount_amount 
      ? parseFloat(formData.max_discount_amount) 
      : null;

    const days = parseInt(formData.valid_days) || 30;
    const validToDate = new Date();
    validToDate.setDate(validToDate.getDate() + days);

    setIsSubmitting(true);
    try {
      const res = await api.createCoupon({
        code,
        discount_type: formData.discount_type,
        discount_value: discountValue,
        min_order_amount: minOrder,
        max_discount_amount: maxDiscount,
        first_order_only: formData.first_order_only,
        valid_to: validToDate.toISOString(),
        max_usage_per_user: parseInt(formData.max_usage_per_user) || 1,
      });

      if (res.data) {
        setCoupons(prev => [res.data!, ...prev]);
        setShowCreateModal(false);
        setSuccessMessage(`تم إنشاء الكوبون ${res.data.code} بنجاح! 🎉`);
        setTimeout(() => setSuccessMessage(null), 4000);
        // Reset form
        setFormData({
          code: '',
          discount_type: 'PERCENT',
          discount_value: '15',
          min_order_amount: '30',
          max_discount_amount: '30',
          first_order_only: false,
          valid_days: '30',
          max_usage_per_user: '1',
        });
      } else {
        setFormError(res.error || 'تعذر إنشاء الكوبون');
      }
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ في الخادم أثناء إنشاء الكوبون');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCoupons = coupons.filter(c => {
    if (filter === 'ACTIVE') return c.is_active;
    if (filter === 'INACTIVE') return !c.is_active;
    return true;
  });

  const activeCount = coupons.filter(c => c.is_active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Tag size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">العروض وكوبونات الخصم</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              أنشئ وأدر كوبونات الخصم الحصرية لمتجرك لزيادة المبيعات وجذب عملاء جدد
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCoupons}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
            title="تحديث القائمة"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-2 shadow-md shadow-primary/25 transition-all text-sm"
          >
            <Plus size={18} />
            <span>إنشاء كوبون جديد</span>
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn text-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn text-sm">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">إجمالي الكوبونات</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{coupons.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Tag size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">الكوبونات النشطة الآن</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Sparkles size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">إجمالي مرات الاستخدام</p>
            <h3 className="text-2xl font-black text-primary mt-1">{totalRedemptions}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-primary flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          الكل ({coupons.length})
        </button>
        <button
          onClick={() => setFilter('ACTIVE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            filter === 'ACTIVE'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          النشطة فقط ({activeCount})
        </button>
        <button
          onClick={() => setFilter('INACTIVE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            filter === 'INACTIVE'
              ? 'bg-slate-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          المعطلة ({coupons.length - activeCount})
        </button>
      </div>

      {/* Coupons List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={28} className="animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-500">جاري تحميل الكوبونات...</p>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-primary flex items-center justify-center mb-4">
            <Tag size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">لا توجد كوبونات مضافة بعد</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            قم بإنشاء كوبون خصم لمتجرك لتشجيع العملاء على إتمام طلباتهم وتكرار الشراء.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-md shadow-primary/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>إنشاء أول كوبون</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between ${
                coupon.is_active ? 'border-slate-200' : 'border-slate-200 opacity-75 bg-slate-50/50'
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header: Code & Active Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="border-2 border-dashed border-primary/40 bg-orange-50 font-mono font-black text-primary px-3 py-1.5 rounded-xl text-base tracking-wider flex items-center gap-2">
                      <span>{coupon.code}</span>
                      <button
                        onClick={() => copyToClipboard(coupon.code)}
                        className="text-primary hover:text-primary/70 transition-colors"
                        title="نسخ الكود"
                      >
                        {copiedCode === coupon.code ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Toggle Active Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coupon.is_active}
                      onChange={() => handleToggle(coupon)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Discount Badge & Info */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {coupon.discount_type === 'PERCENT' ? (
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-primary flex items-center justify-center font-bold">
                        <Percent size={16} />
                      </div>
                    ) : coupon.discount_type === 'FREE_DELIVERY' ? (
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        <Truck size={16} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                        <DollarSign size={16} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {coupon.discount_type === 'PERCENT'
                          ? `خصم ${parseFloat(String(coupon.discount_value))}%`
                          : coupon.discount_type === 'FREE_DELIVERY'
                          ? 'توصيل مجاني 🛵'
                          : `خصم ${parseFloat(String(coupon.discount_value))} ج.م`}
                      </p>
                      {coupon.discount_type === 'PERCENT' && coupon.max_discount_amount && (
                        <p className="text-[11px] text-slate-500">
                          بحد أقصى {parseFloat(String(coupon.max_discount_amount))} ج.م
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {coupon.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>

                {/* Conditions & Criteria */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">الحد الأدنى للطلب:</span>
                    <span className="font-bold text-slate-700">{parseFloat(String(coupon.min_order_amount))} ج.م</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">الفئة المستهدفة:</span>
                    <span className="font-semibold text-slate-700">
                      {coupon.first_order_only ? (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">للطلب الأول فقط ⭐</span>
                      ) : (
                        'جميع العملاء'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">تاريخ الانتهاء:</span>
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      {new Date(coupon.valid_to).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Usage Statistics */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Users size={14} className="text-slate-400" />
                  عدد مرات الاستخدام:
                </span>
                <span className="font-black text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {coupon.usage_count || 0} مرة
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create New Store Coupon */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-fadeIn relative space-y-6">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-primary/20 flex items-center justify-center text-primary">
                <Tag size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">إنشاء كوبون خصم جديد</h3>
                <p className="text-xs text-slate-500">كوبون خاص بمتجرك يتحمل خصمه المتجر</p>
              </div>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              {/* Coupon Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كود الكوبون <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: FOX20 أو SUMMER15"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-base font-bold uppercase tracking-wider text-slate-800"
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'PERCENT' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      formData.discount_type === 'PERCENT'
                        ? 'border-primary bg-orange-50 text-primary shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Percent size={16} />
                    <span>نسبة مئوية (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FLAT' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      formData.discount_type === 'FLAT'
                        ? 'border-primary bg-orange-50 text-primary shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign size={16} />
                    <span>مبلغ ثابت (ج.م)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FREE_DELIVERY', discount_value: '0' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      formData.discount_type === 'FREE_DELIVERY'
                        ? 'border-primary bg-orange-50 text-primary shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Truck size={16} />
                    <span>توصيل مجاني</span>
                  </button>
                </div>
              </div>

              {/* Discount Value & Max Discount */}
              {formData.discount_type !== 'FREE_DELIVERY' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {formData.discount_type === 'PERCENT' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (ج.م)'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={formData.discount_type === 'PERCENT' ? "100" : undefined}
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                    />
                  </div>

                  {formData.discount_type === 'PERCENT' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الحد الأقصى للخصم (ج.م)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="اختياري"
                        value={formData.max_discount_amount}
                        onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Min Order Amount & Expiry in Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الحد الأدنى للطلب (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مدة الصلاحية (بالأيام)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.valid_days}
                    onChange={(e) => setFormData({ ...formData, valid_days: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  />
                </div>
              </div>

              {/* First order only checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={formData.first_order_only}
                    onChange={(e) => setFormData({ ...formData, first_order_only: e.target.checked })}
                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">مخصص للطلب الأول فقط (عملاء جدد)</span>
                    <p className="text-[11px] text-slate-500">لن يتمكن أي عميل لديه طلب سابق من استخدام هذا الكوبون</p>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs shadow-md shadow-primary/25 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>إنشاء وتفعيل الكوبون</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
