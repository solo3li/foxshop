import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  CreditCard, 
  Package, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  FileSpreadsheet,
  Bike
} from 'lucide-react';
import type { Order } from '../types';
import { api } from '../api/client';

interface OrdersArchiveProps {
  onSelectOrder: (orderId: string) => void;
}

export const OrdersArchive: React.FC<OrdersArchiveProps> = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);

    // Calculate dates based on range
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    const now = new Date();
    if (dateRange === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFrom = startOfDay.toISOString();
    } else if (dateRange === 'WEEK') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFrom = sevenDaysAgo.toISOString();
    } else if (dateRange === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = startOfMonth.toISOString();
    }

    const res = await api.getAllOrders({
      search: searchQuery || undefined,
      status: statusFilter,
      payment_method: paymentFilter,
      date_from: dateFrom,
      date_to: dateTo,
    });

    if (res.data) {
      setOrders(res.data);
    } else {
      setError(res.error || 'تعذر تحميل قائمة الطلبات');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    setCurrentPage(1);
  }, [statusFilter, paymentFilter, dateRange]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDateRange('ALL');
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.status === 'DELIVERED');
    const cancelled = orders.filter(o => o.status === 'CANCELLED');
    const totalRevenue = delivered.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0;

    return {
      totalOrders,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      totalRevenue,
      avgOrderValue
    };
  }, [orders]);

  // Pagination Slice
  const totalPages = Math.ceil(orders.length / itemsPerPage) || 1;
  const paginatedOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'بانتظار الموافقة', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'CONFIRMED':
        return { label: 'مؤكد', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'PREPARING':
        return { label: 'قيد التحضير', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'READY_FOR_PICKUP':
        return { label: 'جاهز للاستلام', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY':
      case 'ON_THE_WAY':
        return { label: 'في الطريق', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'DELIVERED':
        return { label: 'تم التسليم', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'CANCELLED':
        return { label: 'ملغي', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">سجل كافة الطلبات</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            استعرض وتتبع كافة الفواتير والطلبات السابقة والحالية مع تحليلات المبيعات
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 text-primary flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">إجمالي الطلبات</span>
            <span className="text-lg font-black text-slate-900 leading-tight">{stats.totalOrders}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">طلبات مكتملة</span>
            <span className="text-lg font-black text-emerald-700 leading-tight">{stats.deliveredCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">طلبات ملغاة</span>
            <span className="text-lg font-black text-rose-700 leading-tight">{stats.cancelledCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">إجمالي المبيعات</span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {stats.totalRevenue.toFixed(0)} <span className="text-xs font-bold text-slate-500">ر.س</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">متوسط الفاتورة</span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {stats.avgOrderValue.toFixed(1)} <span className="text-xs font-bold text-slate-500">ر.س</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطلب # أو اسم العميل أو الجوال..."
              className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
            />
          </div>

          {/* Status Dropdown */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PENDING">بانتظار الموافقة</option>
              <option value="CONFIRMED">تم التأكيد</option>
              <option value="PREPARING">قيد التحضير</option>
              <option value="READY_FOR_PICKUP">جاهز للاستلام</option>
              <option value="ON_THE_WAY">في الطريق</option>
              <option value="DELIVERED">تم التسليم بنجاح</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>

          {/* Date Range Dropdown */}
          <div className="md:col-span-3">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="ALL">كافة الفترات الزمنية</option>
              <option value="TODAY">طلبات اليوم فقط</option>
              <option value="WEEK">آخر 7 أيام</option>
              <option value="MONTH">هذا الشهر</option>
            </select>
          </div>

          {/* Payment Method Dropdown */}
          <div className="md:col-span-2">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="ALL">كل طرق الدفع</option>
              <option value="COD">كاش (عند الاستلام)</option>
              <option value="CARD">بطاقة إلكترونية</option>
              <option value="WALLET">المحفظة</option>
            </select>
          </div>
        </div>

        {/* Active Filters summary & Reset */}
        {(searchQuery || statusFilter !== 'ALL' || paymentFilter !== 'ALL' || dateRange !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>تم تطبيق فلاتر تصفية مخصصة</span>
            <button
              onClick={handleResetFilters}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              مسح جميع الفلاتر
            </button>
          </div>
        )}
      </div>

      {/* Orders Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">رقم الطلب</th>
                <th className="py-3.5 px-4">العميل</th>
                <th className="py-3.5 px-4">التوقيت</th>
                <th className="py-3.5 px-4">الأصناف</th>
                <th className="py-3.5 px-4">طريقة الدفع</th>
                <th className="py-3.5 px-4">الإجمالي</th>
                <th className="py-3.5 px-4">حالة الطلب</th>
                <th className="py-3.5 px-4">الكابتن</th>
                <th className="py-3.5 px-4 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    جاري تحميل سجل الطلبات...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-sm text-slate-600">لا توجد طلبات تطابق معايير البحث الحالية</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const badge = getStatusBadge(order.status);
                  const driver = order.delivery_info;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-black text-slate-900 group-hover:text-primary transition-colors">
                        #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.customer_name || 'عميل'}</div>
                        {order.customer_phone && (
                          <div dir="ltr" className="text-[11px] text-slate-400 font-medium">
                            {order.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div>{new Date(order.created_at).toLocaleDateString('ar-SA')}</div>
                        <div className="text-slate-400">{new Date(order.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-800">
                          {order.items ? order.items.length : 0} وجبات
                        </span>
                        {order.items && order.items.length > 0 && (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">
                            {order.items.map(i => i.menu_item_name).join('، ')}
                          </span>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {order.payment_method === 'COD' ? 'كاش (استلام)' : 'إلكتروني'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-black text-slate-900 text-xs">
                        {Number(order.total_amount).toFixed(2)} ر.س
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Captain */}
                      <td className="py-3.5 px-4">
                        {driver && driver.driver_name ? (
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Bike size={13} className="text-primary shrink-0" />
                            <span className="font-bold text-[11px] truncate max-w-[90px]">{driver.driver_name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">قيد التعيين</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(order.id);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center"
                          title="عرض تفاصيل الطلب كاملة"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold">
            عرض صفحة {currentPage} من أصل {totalPages} (إجمالي {orders.length} طلب)
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="الصفحة السابقة"
            >
              <ChevronRight size={16} />
            </button>
            <span className="px-3 font-black text-slate-800">{currentPage}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="الصفحة التالية"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
