import React, { useEffect, useState } from 'react';
import { Search, UtensilsCrossed, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useMenuStore } from '../store/menuStore';

export const MenuManager: React.FC = () => {
  const { items, isLoading, fetchMenuItems, toggleAvailability } = useMenuStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    await toggleAvailability(id);
    setTogglingId(null);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <UtensilsCrossed size={22} className="text-primary" />
            <span>إدارة توفر قائمة الطعام (Item 86)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            قم بإيقاف الأصناف النافذة فوراً لتختفي من تطبيق العميل وتجنب إلغاء الطلبات.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن وجبة أو مشروب..."
            className="w-full pr-10 pl-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>

      {/* Grid of Menu Items */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 font-bold text-sm">
          جاري تحميل قائمة الوجبات...
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`
                bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between gap-3
                ${item.is_available ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Item Image */}
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed size={24} className="text-slate-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-slate-800 truncate">{item.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                  <span className="text-xs font-extrabold text-primary mt-1 inline-block">
                    {item.base_price} ر.س
                  </span>
                </div>
              </div>

              {/* Availability Toggle Switch */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className={`text-xs font-bold flex items-center gap-1 ${item.is_available ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {item.is_available ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>متوفر في المنيو</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      <span>غير متوفر (نافد)</span>
                    </>
                  )}
                </span>

                <button
                  onClick={() => handleToggle(item.id)}
                  disabled={togglingId === item.id}
                  className={`
                    w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out
                    ${item.is_available ? 'bg-emerald-500 justify-start' : 'bg-slate-300 justify-end'}
                    ${togglingId === item.id ? 'opacity-50 cursor-wait' : ''}
                  `}
                  title={item.is_available ? 'إيقاف توفر الوجبة' : 'إتاحة توفر الوجبة'}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="font-bold text-sm">لم يتم العثور على أي وجبات تطابق البحث</p>
        </div>
      )}
    </div>
  );
};
