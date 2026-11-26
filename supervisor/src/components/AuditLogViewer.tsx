import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Send,
  UserCheck,
  UserX,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserPlus,
  ShieldAlert,
  MapPin,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';
import { api } from '../api/client';
import type { AuditLogEntry } from '../types';

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionTypes, setActionTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const res = await api.getAuditLogs({
      action_type: actionFilter,
      search: search,
      limit: 100,
    });
    if (res.data) {
      setLogs(res.data.logs || []);
      if (res.data.action_types) {
        setActionTypes(res.data.action_types);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'MANUAL_DISPATCH':
        return {
          icon: <Send className="w-3.5 h-3.5" />,
          badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        };
      case 'DRIVER_APPROVED':
        return {
          icon: <UserCheck className="w-3.5 h-3.5" />,
          badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        };
      case 'DRIVER_DEACTIVATED':
        return {
          icon: <UserX className="w-3.5 h-3.5" />,
          badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        };
      case 'CASH_SETTLED':
        return {
          icon: <DollarSign className="w-3.5 h-3.5" />,
          badgeClass: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
        };
      case 'CASH_APPROVAL_REQUESTED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        };
      case 'CASH_APPROVED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        };
      case 'CASH_REJECTED':
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          badgeClass: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
        };
      case 'SUPERVISOR_CREATED':
      case 'SUPERVISOR_STATUS_TOGGLE':
        return {
          icon: <UserPlus className="w-3.5 h-3.5" />,
          badgeClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        };
      case 'ZONE_CREATED':
      case 'ZONE_ASSIGNED':
        return {
          icon: <MapPin className="w-3.5 h-3.5" />,
          badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
        };
      default:
        return {
          icon: <Layers className="w-3.5 h-3.5" />,
          badgeClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              سجل تدقيق ورقابة العمليات (Audit Trail)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-medium border border-purple-200 dark:border-purple-800">
                Surveillance Feed
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              تتبع فوري ومفصل لكافة الإجراءات المتخذة بواسطة المشرفين ومديري العمليات
            </p>
          </div>
        </div>

        <button
          onClick={() => loadLogs()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالهدف، اسم المشرف، أو المعرف..."
            className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">جميع أنواع الإجراءات</option>
            {actionTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">جاري جلب سجل التدقيق...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">لا توجد حركات مسجلة</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            لم يتم تسجيل أي عمليات تطابق معايير الفلترة الحالية.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const badge = getActionBadge(log.action_type);
            const isExpanded = expandedLogId === log.id;
            const hasDetails = log.details && Object.keys(log.details).length > 0;

            return (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${badge.badgeClass} shrink-0 mt-0.5`}
                    >
                      {badge.icon}
                      <span>{log.action_label}</span>
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {log.actor_name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {log.actor_role}
                        </span>
                        <span className="text-xs text-slate-400">نفّذ على:</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {log.target_name || log.target_type || 'نظام'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {log.created_at}
                        </span>
                        {log.ip_address && (
                          <span className="flex items-center gap-1 font-mono">
                            <Globe className="w-3 h-3" />
                            {log.ip_address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {hasDetails && (
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-center"
                    >
                      <span>{isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Collapsible JSON payload */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-400 block mb-1">حمولة البيانات (Payload JSON):</span>
                    <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto" dir="ltr">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
