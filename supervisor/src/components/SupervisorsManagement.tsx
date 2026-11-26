import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Lock,
  Edit2,
  Sliders,
  AlertCircle,
  X
} from 'lucide-react';
import { api } from '../api/client';
import type { SupervisorMember, DeliveryZoneItem } from '../types';

interface SupervisorsManagementProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SupervisorsManagement({ onNotify }: SupervisorsManagementProps) {
  const [members, setMembers] = useState<SupervisorMember[]>([]);
  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'SUPERVISOR' | 'OPS_MANAGER'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<SupervisorMember | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: 'SUPERVISOR' as 'SUPERVISOR' | 'OPS_MANAGER',
    zone_ids: [] as string[],
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [teamRes, zonesRes] = await Promise.all([
      api.getSupervisors(roleFilter, search),
      api.getDeliveryZones(),
    ]);

    if (teamRes.data) {
      setMembers(teamRes.data.members || []);
    }
    if (zonesRes.data) {
      setZones(zonesRes.data.zones || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleToggleActive = async (member: SupervisorMember) => {
    const nextStatus = !member.is_active;
    const confirmMsg = nextStatus
      ? `هل أنت متأكد من تفعيل حساب المشرف (${member.full_name})؟`
      : `هل أنت متأكد من تجميد/تعطيل حساب المشرف (${member.full_name})؟`;

    if (!window.confirm(confirmMsg)) return;

    const res = await api.updateSupervisor(member.id, { is_active: nextStatus });
    if (res.data) {
      onNotify?.(res.data.message || 'تم تحديث حالة الحساب بنجاح', 'success');
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_active: nextStatus } : m))
      );
    } else {
      onNotify?.(res.error || 'فشل تحديث حالة الحساب', 'error');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    const res = await api.createSupervisor(formData);
    setFormSubmitting(false);

    if (res.data) {
      onNotify?.(res.data.message, 'success');
      setIsAddModalOpen(false);
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        role: 'SUPERVISOR',
        zone_ids: [],
      });
      loadData();
    } else {
      setFormError(res.error || 'فشل في إنشاء الحساب');
    }
  };

  const handleUpdateRole = async (member: SupervisorMember, newRole: 'SUPERVISOR' | 'OPS_MANAGER') => {
    const res = await api.updateSupervisor(member.id, { role: newRole });
    if (res.data) {
      onNotify?.('تم تحديث رتبة المشرف بنجاح', 'success');
      loadData();
      setSelectedMemberForEdit(null);
    } else {
      onNotify?.(res.error || 'فشل التحديث', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              إدارة فريق المشرفين والعمليات
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-200 dark:border-indigo-800">
                Talabat Ops Suite
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              إضافة المشرفين، إدارة صلاحياتهم، توزيع الزونات ومراقبة نشاطهم
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            <span>إضافة مشرف جديد</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، اسم المستخدم، رقم الهاتف أو البريد..."
            className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                roleFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكل ({members.length})
            </button>
            <button
              onClick={() => setRoleFilter('OPS_MANAGER')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                roleFilter === 'OPS_MANAGER'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>مديرو العمليات</span>
            </button>
            <button
              onClick={() => setRoleFilter('SUPERVISOR')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                roleFilter === 'SUPERVISOR'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>المشرفون</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supervisors Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">جاري تحميل بيانات الفريق...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">لا يوجد مشرفون مسجلون</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            اضغط على زر "إضافة مشرف جديد" لإنشاء أول حساب للمشرف أو مدير العمليات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const isManager = member.role === 'OPS_MANAGER' || member.role === 'ADMIN';
            return (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar with Role & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isManager ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Crown className="w-3.5 h-3.5" />
                          <span>مدير عمليات (Ops Manager)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          <Shield className="w-3.5 h-3.5" />
                          <span>مشرف تشغيل (Supervisor)</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {member.is_active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>حساب نشط</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>معطل / مجمد</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Profile Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-lg border border-slate-200 dark:border-slate-700">
                      {member.full_name?.charAt(0) || member.username?.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate text-base">
                        {member.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        @{member.username}
                      </p>
                      {member.phone_number && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span dir="ltr">{member.phone_number}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assigned Zones */}
                  <div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 mb-1.5">
                      <MapPin className="w-3 h-3" />
                      الزونات المسندة:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {member.assigned_zones && member.assigned_zones.length > 0 ? (
                        member.assigned_zones.map((z) => (
                          <span
                            key={z.id}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono"
                          >
                            {z.name} ({z.code})
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">نطاق عام (كل المنصة)</span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Today */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">إرسال يدوي اليوم</span>
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {member.metrics?.dispatches_today ?? 0}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">تسويات كاش</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                        {member.metrics?.settlements_today ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 px-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedMemberForEdit(member)}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>تعديل الصلاحيات</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(member)}
                    className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      member.is_active
                        ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    {member.is_active ? 'تجميد الحساب' : 'إلغاء التجميد'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Supervisor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>إضافة حساب مشرف / مدير جديد</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الأول *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder="أحمد"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    اسم العائلة *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder="محمود"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono"
                  placeholder="ahmed_ops"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور * (6 أحرف على الأقل)
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder="01012345678"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    placeholder="ops@foxshop.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  الرتبة والدور الصلاحياتي *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'SUPERVISOR' })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'SUPERVISOR'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>مشرف تشغيل</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      إرسال الطلبات، رادار الكباتن وتسوية الكاش بسقف محدد
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'OPS_MANAGER' })}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      formData.role === 'OPS_MANAGER'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                      <Crown className="w-4 h-4" />
                      <span>مدير العمليات</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      إدارة المشرفين، سجل التدقيق، واعتماد التسويات الكبرى
                    </p>
                  </button>
                </div>
              </div>

              {zones.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    تعيين منطقة تشغيل (اختياري - زونات طلبات)
                  </label>
                  <select
                    multiple
                    value={formData.zone_ids}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      setFormData({ ...formData, zone_ids: selected });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white h-20"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.code}) - {z.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>إنشاء الحساب الآن</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {selectedMemberForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                تعديل رتبة ({selectedMemberForEdit.full_name})
              </h3>
              <button
                onClick={() => setSelectedMemberForEdit(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">اختر الرتبة الإدارية الجديدة للمستخدم:</p>

            <div className="space-y-2">
              <button
                onClick={() => handleUpdateRole(selectedMemberForEdit, 'SUPERVISOR')}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 flex items-center gap-2 text-right transition-colors"
              >
                <Shield className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">مشرف تشغيل</span>
                  <span className="text-[11px] text-slate-400">صلاحيات غرفة الإرسال والرادار والتسويات</span>
                </div>
              </button>

              <button
                onClick={() => handleUpdateRole(selectedMemberForEdit, 'OPS_MANAGER')}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 flex items-center gap-2 text-right transition-colors"
              >
                <Crown className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">مدير عمليات</span>
                  <span className="text-[11px] text-slate-400">إدارة الفريق، سجل الرقابة والاعتمادات المالية</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
