import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  DollarSign,
  User,
  Phone,
  Clock,
  ShieldCheck,
  FileText,
  X
} from 'lucide-react';
import { api } from '../api/client';
import type { PendingApprovalItem } from '../types';

interface PendingApprovalsProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
  onRefreshBadge?: () => void;
}

export function PendingApprovals({ onNotify, onRefreshBadge }: PendingApprovalsProps) {
  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection Modal
  const [rejectingItem, setRejectingItem] = useState<PendingApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadApprovals = async () => {
    setLoading(true);
    const res = await api.getPendingApprovals();
    if (res.data) {
      setApprovals(res.data.pending_approvals || []);
      onRefreshBadge?.();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleApprove = async (item: PendingApprovalItem) => {
    if (!window.confirm(`هل أنت متأكد من اعتماد توريد مبلغ ${item.amount} ج.م من الكابتن (${item.driver_name})؟`)) {
      return;
    }

    setProcessingId(item.id);
    const res = await api.reviewPendingApproval(item.id, 'approve');
    setProcessingId(null);

    if (res.data) {
      onNotify?.(res.data.message || 'تم اعتماد التسوية بنجاح', 'success');
      setApprovals((prev) => prev.filter((a) => a.id !== item.id));
      onRefreshBadge?.();
    } else {
      onNotify?.(res.error || 'فشل اعتماد التسوية', 'error');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    setProcessingId(rejectingItem.id);
    const res = await api.reviewPendingApproval(rejectingItem.id, 'reject', rejectReason);
    setProcessingId(null);

    if (res.data) {
      onNotify?.(res.data.message || 'تم رفض التسوية', 'info');
      setApprovals((prev) => prev.filter((a) => a.id !== rejectingItem.id));
      setRejectingItem(null);
      setRejectReason('');
      onRefreshBadge?.();
    } else {
      onNotify?.(res.error || 'فشل رفض التسوية', 'error');
    }
  };

  const totalPendingAmount = approvals.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              صندوق الموافقات المعلقة (Pending Approvals)
              {approvals.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                  {approvals.length} معلقة
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              تسويات الكاش التي تتجاوز السقف التشغيلي للمشرف وتتطلب موافقة مدير العمليات
            </p>
          </div>
        </div>

        <button
          onClick={() => loadApprovals()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الطلبات</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 block mb-1">
              عدد الطلبات بانتظار الاعتماد
            </span>
            <span className="text-3xl font-extrabold text-amber-900 dark:text-amber-200">
              {approvals.length}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 block mb-1">
              إجمالي المبالغ المعلقة للتوريد
            </span>
            <span className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-200">
              {totalPendingAmount.toLocaleString()} <span className="text-lg font-normal">ج.م</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">جاري مراجعة الطلبات المعلقة...</p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <ShieldCheck className="w-14 h-14 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            جميع التسويات النقدية معتمدة ومحدثة ✨
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            لا توجد أي سندات توريد معلقة تنتظر موافقة مدير العمليات حالياً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm">
                    {item.driver_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.driver_name}
                    </h3>
                    {item.driver_phone && (
                      <p className="text-xs text-slate-500 font-mono" dir="ltr">
                        {item.driver_phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-left font-mono text-xs text-slate-400">
                  {item.created_at}
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">
                    المبلغ المطلوب توريده
                  </span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {item.amount.toLocaleString()} <span className="text-sm">ج.م</span>
                  </span>
                </div>

                <div className="text-left text-xs space-y-1">
                  <div className="text-slate-500">
                    الرصيد الحالي: <span className="font-bold text-slate-900 dark:text-white">{item.balance_before} ج.م</span>
                  </div>
                  <div className="text-emerald-600 font-bold">
                    الرصيد بعد التوريد: {item.balance_after} ج.م
                  </div>
                </div>
              </div>

              {/* Submitter & Notes */}
              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>المشرف مقدم الطلب: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.supervisor_name}</span>
                </div>
                {item.notes && (
                  <div className="flex items-start gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>ملاحظات: {item.notes}</span>
                  </div>
                )}
              </div>

              {/* Decision Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => handleApprove(item)}
                  disabled={processingId === item.id}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد التوريد فوراً ✅</span>
                </button>

                <button
                  onClick={() => {
                    setRejectingItem(item);
                    setRejectReason('');
                  }}
                  disabled={processingId === item.id}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 inline mr-1" />
                  <span>رفض</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>رفض سند التوريد</span>
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              أنت على وشك رفض سند التوريد بمبلغ <span className="font-bold text-rose-600">{rejectingItem.amount} ج.م</span> للكابتن ({rejectingItem.driver_name}). يرجى ذكر سبب الرفض لتسجيله في النظام:
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: المبلغ غير مطابق للحوالة البنكية / خطأ في رقم السند..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingItem.id}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                >
                  تأكيد الرفض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
