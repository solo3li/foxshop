import React, { useState } from 'react';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Search,
  CreditCard,
  X,
  History,
  Phone,
  ArrowDownLeft,
} from 'lucide-react';
import type { CashReconciliationData } from '../types';

interface CashManagementProps {
  data: CashReconciliationData | null;
  onSettle: (driver_id: string, amount?: number | string, notes?: string) => Promise<{ success: boolean; message: string }>;
  onRefresh: () => void;
}

export const CashManagement: React.FC<CashManagementProps> = ({ data, onSettle, onRefresh }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'over_debt' | 'has_cash'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'drivers' | 'history'>('drivers');

  // Settle modal state
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!data) return null;

  const { cod_max_ceiling, total_market_cash, over_limit_count, drivers, recent_settlements } = data;

  const filteredDrivers = drivers.filter((driver) => {
    if (filterMode === 'over_debt' && !driver.is_over_limit) return false;
    if (filterMode === 'has_cash' && driver.cash_in_hand <= 0) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        driver.name.toLowerCase().includes(q) ||
        driver.username.toLowerCase().includes(q) ||
        driver.phone_number.includes(q)
      );
    }
    return true;
  });

  const openSettleModal = (driver: any) => {
    setSelectedDriver(driver);
    setSettleAmount(String(driver.cash_in_hand));
    setSettleNotes(`توريد كاش نقدي - ${new Date().toLocaleDateString('ar-SA')}`);
    setActionMessage(null);
  };

  const closeSettleModal = () => {
    setSelectedDriver(null);
    setSettleAmount('');
    setSettleNotes('');
    setActionMessage(null);
  };

  const handleExecuteSettlement = async () => {
    if (!selectedDriver) return;

    setIsSubmitting(true);
    setActionMessage(null);

    const amountNum = parseFloat(settleAmount);
    const res = await onSettle(selectedDriver.id, isNaN(amountNum) ? 'all' : amountNum, settleNotes);

    setIsSubmitting(false);

    if (res.success) {
      setActionMessage({ text: res.message, type: 'success' });
      setTimeout(() => {
        closeSettleModal();
        onRefresh();
      }, 1200);
    } else {
      setActionMessage({ text: res.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Cash */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي كاش السوق المحصل</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">
              {total_market_cash.toLocaleString('ar-SA')}
            </span>
            <span className="text-sm font-bold text-slate-500">ج.م</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            مبالغ الطلبات النقدية (COD) المحصلة بعهدة الكباتن حالياً
          </p>
        </div>

        {/* Debt Ceiling */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">سقف المديونية المسموح به</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {cod_max_ceiling.toLocaleString('ar-SA')}
            </span>
            <span className="text-sm font-bold text-slate-500">ج.م / كابتن</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            يتم حجب التعيين التلقائي عن أي كابتن يتجاوز هذا السقف حتى التوريد
          </p>
        </div>

        {/* Over Ceiling Warning */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">تجاوزات سقف المديونية</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                over_limit_count > 0
                  ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold ${
                over_limit_count > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {over_limit_count}
            </span>
            <span className="text-sm text-slate-500">كابتن محظور</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {over_limit_count > 0
              ? 'مطلوب تحصيل الكاش فوراً لإعادة إتاحتهم على الخريطة'
              : 'جميع الكباتن ملتزمون بالسقف المحدد'}
          </p>
        </div>
      </div>

      {/* Main Sub-tabs & Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'drivers'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>أرصدة الكباتن والتحصيل ({drivers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل التوريدات الحديثة ({recent_settlements.length})</span>
            </button>
          </div>

          {activeTab === 'drivers' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث باسم الكابتن أو الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary w-48 sm:w-64 shadow-sm"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    filterMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterMode('over_debt')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    filterMode === 'over_debt' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-rose-600'
                  }`}
                >
                  متجاوزين للسقف
                </button>
                <button
                  onClick={() => setFilterMode('has_cash')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    filterMode === 'has_cash' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-amber-600'
                  }`}
                >
                  عليهم مديونية
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Drivers Cash Reconciliation Table */}
        {activeTab === 'drivers' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                  <th className="py-3 px-3 font-bold">الكابتن</th>
                  <th className="py-3 px-3 font-bold">المركبة</th>
                  <th className="py-3 px-3 font-bold">الكاش بيده</th>
                  <th className="py-3 px-3 font-bold w-48">نسبة سقف المديونية</th>
                  <th className="py-3 px-3 font-bold">الطلبات المنجزة</th>
                  <th className="py-3 px-3 font-bold">آخر توريد</th>
                  <th className="py-3 px-3 font-bold text-center">إجراء التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      لا يوجد كباتن مطابقين للبحث
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((driver) => {
                    const pct = Math.min(driver.limit_percent, 100);
                    return (
                      <tr key={driver.id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 text-sm">{driver.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-sky-600" />
                            <span>{driver.phone_number || '-'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-700">
                          {driver.vehicle_type}
                        </td>

                        <td className="py-3.5 px-3">
                          <div
                            className={`text-sm font-extrabold ${
                              driver.is_over_limit
                                ? 'text-rose-600'
                                : driver.cash_in_hand > 0
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {driver.cash_in_hand.toFixed(2)} ج.م
                          </div>
                          {driver.is_over_limit && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> تجاوز سقف {cod_max_ceiling} ج.م
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                            <span className="text-slate-600 font-bold">{driver.limit_percent}%</span>
                            <span className="text-slate-400">من {cod_max_ceiling} ج.م</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                driver.is_over_limit
                                  ? 'bg-rose-500'
                                  : pct > 60
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-800 font-bold">
                          {driver.total_delivered_orders} طلب
                        </td>

                        <td className="py-3.5 px-3 text-slate-500">
                          {driver.last_settlement ? (
                            <div>
                              <div className="text-slate-800 font-bold">
                                {driver.last_settlement.amount} ج.م
                              </div>
                              <div className="text-[10px] text-slate-400">{driver.last_settlement.date}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">لا يوجد سابقاً</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => openSettleModal(driver)}
                            disabled={driver.cash_in_hand <= 0}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto ${
                              driver.is_over_limit
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                                : driver.cash_in_hand > 0
                                ? 'bg-primary hover:bg-primary-dark text-white shadow-sm shadow-primary/20'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>تسجيل توريد</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: Recent Settlements Audit Trail */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                  <th className="py-3 px-3 font-bold">تاريخ وساعة التوريد</th>
                  <th className="py-3 px-3 font-bold">الكابتن</th>
                  <th className="py-3 px-3 font-bold">المبلغ المورد</th>
                  <th className="py-3 px-3 font-bold">الرصيد قبل</th>
                  <th className="py-3 px-3 font-bold">الرصيد بعد</th>
                  <th className="py-3 px-3 font-bold">المشرف المستلم</th>
                  <th className="py-3 px-3 font-bold">ملاحظات / السند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent_settlements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      لا توجد سندات توريد مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  recent_settlements.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-slate-500 font-mono">
                        {record.created_at}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{record.driver_name}</div>
                        <div className="text-[10px] text-slate-400">{record.driver_phone}</div>
                      </td>

                      <td className="py-3 px-3 font-extrabold text-emerald-600 text-sm">
                        +{record.amount.toFixed(2)} ج.م
                      </td>

                      <td className="py-3 px-3 text-slate-500 font-mono">
                        {record.balance_before.toFixed(2)} ج.م
                      </td>

                      <td className="py-3 px-3 text-slate-800 font-mono font-bold">
                        {record.balance_after.toFixed(2)} ج.م
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {record.supervisor_name}
                      </td>

                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Cash Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center border border-primary-100">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">تسجيل توريد كاش نقدي</h3>
                  <p className="text-xs text-slate-500">{selectedDriver.name}</p>
                </div>
              </div>
              <button
                onClick={closeSettleModal}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Balance Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">المديونية الحالية بعهدة الكابتن</div>
                  <div className="text-xl font-extrabold text-amber-600 mt-0.5">
                    {selectedDriver.cash_in_hand.toFixed(2)} ج.م
                  </div>
                </div>
                <div className="text-left text-xs">
                  <span className="text-slate-400">سقف المديونية: </span>
                  <span className="font-bold text-slate-800">{cod_max_ceiling} ج.م</span>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المبلغ المراد تحصيله وتوريده (ج.م):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedDriver.cash_in_hand}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:border-primary shadow-sm transition"
                  />
                  <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">ج.م</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setSettleAmount(String(selectedDriver.cash_in_hand))}
                    className="px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 text-[11px] font-bold text-primary border border-primary-200 transition"
                  >
                    كامل الرصيد ({selectedDriver.cash_in_hand} ج.م)
                  </button>
                  {selectedDriver.cash_in_hand >= 100 && (
                    <button
                      type="button"
                      onClick={() => setSettleAmount(String(Math.floor(selectedDriver.cash_in_hand / 2)))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 border border-slate-200 transition"
                    >
                      النصف ({Math.floor(selectedDriver.cash_in_hand / 2)} ج.م)
                    </button>
                  )}
                </div>
              </div>

              {/* Notes input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم السند / ملاحظات التوريد:
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="مثال: سند استلام نقدي #4821 أو تحويل بنكي"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-primary shadow-sm transition"
                />
              </div>

              {/* Action Feedback */}
              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    actionMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={closeSettleModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteSettlement}
                disabled={isSubmitting || !settleAmount || parseFloat(settleAmount) <= 0}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري التسجيل...' : 'تأكيد وحفظ التوريد'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
