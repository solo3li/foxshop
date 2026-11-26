import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  X, 
  RefreshCw, 
  Tag, 
  Layers,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  Link as LinkIcon
} from 'lucide-react';
import { api } from '../api/client';
import { useMenuStore } from '../store/menuStore';
import type { MenuItem, MenuCategory } from '../types';

export const MenuManager: React.FC = () => {
  const {
    categories,
    items,
    selectedCategoryId,
    isLoading,
    setSelectedCategoryId,
    fetchCategories,
    fetchMenuItems,
    createCategory,
    updateCategory,
    deleteCategory,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability
  } = useMenuStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState(0);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    base_price: '',
    category: '',
    image: '',
    is_available: true,
    is_popular: false
  });
  const [itemSubmitting, setItemSubmitting] = useState(false);

  // Image Upload State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmations
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchMenuItems();
  }, []);

  // --- Category Handlers ---
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryOrder(categories.length);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (e: React.MouseEvent, cat: MenuCategory) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryOrder(cat.order || 0);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setCategorySubmitting(true);
    let success = false;
    if (editingCategory) {
      success = await updateCategory(editingCategory.id, categoryName.trim());
    } else {
      success = await createCategory(categoryName.trim(), categoryOrder);
    }
    setCategorySubmitting(false);

    if (success) {
      setIsCategoryModalOpen(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setDeletingId(categoryToDelete.id);
    await deleteCategory(categoryToDelete.id);
    setDeletingId(null);
    setCategoryToDelete(null);
  };

  // --- Item Handlers ---
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      description: '',
      base_price: '',
      category: selectedCategoryId || (categories[0]?.id || ''),
      image: '',
      is_available: true,
      is_popular: false
    });
    setImageUploadError(null);
    setIsUploadingImage(false);
    setUploadMode('file');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      base_price: String(item.base_price),
      category: (item.category || item.category_id || '') as string,
      image: item.image || '',
      is_available: item.is_available,
      is_popular: item.is_popular
    });
    setImageUploadError(null);
    setIsUploadingImage(false);
    setUploadMode(item.image && item.image.startsWith('http') && !item.image.includes('/media/') ? 'url' : 'file');
    setIsItemModalOpen(true);
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setImageUploadError('صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError('حجم الصورة كبير جداً، الحد الأقصى هو 10 ميجابايت.');
      return;
    }

    setImageUploadError(null);
    setIsUploadingImage(true);

    const res = await api.uploadMenuItemImage(file);
    setIsUploadingImage(false);

    if (res.data?.url) {
      setItemForm(prev => ({ ...prev, image: res.data!.url }));
    } else {
      setImageUploadError(res.error || 'تعذر رفع الصورة، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setItemForm(prev => ({ ...prev, image: '' }));
    setImageUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.base_price || !itemForm.category) return;

    setItemSubmitting(true);
    const payload: Partial<MenuItem> = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      base_price: itemForm.base_price,
      category: itemForm.category,
      image: itemForm.image.trim() || null,
      is_available: itemForm.is_available,
      is_popular: itemForm.is_popular
    };

    let success = false;
    if (editingItem) {
      success = await updateMenuItem(editingItem.id, payload);
    } else {
      success = await createMenuItem(payload);
    }
    setItemSubmitting(false);

    if (success) {
      setIsItemModalOpen(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setDeletingId(itemToDelete.id);
    await deleteMenuItem(itemToDelete.id);
    setDeletingId(null);
    setItemToDelete(null);
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    await toggleAvailability(id);
    setTogglingId(null);
  };

  // Filtered Items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const itemCatId = (item.category || item.category_id) as string;
    const matchesCategory = selectedCategoryId ? itemCatId === selectedCategoryId : true;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Package size={22} className="text-primary" />
            <span>كتالوج المنتجات والمخزون</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة التصنيفات والمنتجات، والتحكم الفوري في توفر الأصناف (Item 86).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleOpenAddCategory}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={16} className="text-primary" />
            <span>+ تصنيف جديد</span>
          </button>

          <button
            onClick={handleOpenAddItem}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            <span>+ إضافة منتج / صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`
              px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5
              ${selectedCategoryId === null 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
            `}
          >
            <span>جميع الأصناف</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategoryId === null ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {items.length}
            </span>
          </button>

          {categories.map(cat => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`
                  group px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer border
                  ${isSelected 
                    ? 'bg-primary text-white border-primary shadow-sm' 
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}
                `}
              >
                <span>{cat.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {cat.items_count ?? items.filter(it => (it.category || it.category_id) === cat.id).length}
                </span>

                {/* Edit & Delete Quick Icons */}
                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                  <button
                    onClick={(e) => handleOpenEditCategory(e, cat)}
                    className="p-1 hover:bg-black/10 rounded transition-colors"
                    title="تعديل اسم التصنيف"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                    }}
                    className="p-1 hover:bg-rose-500/20 rounded text-rose-300 hover:text-rose-100 transition-colors"
                    title="حذف التصنيف"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الوصف..."
            className="w-full pr-9 pl-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Grid of Menu Items */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 font-bold text-sm flex flex-col items-center justify-center">
          <RefreshCw size={28} className="animate-spin text-primary mb-3" />
          <span>جاري تحميل قائمة المنتجات...</span>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const itemCat = categories.find(c => c.id === (item.category || item.category_id));

            return (
              <div
                key={item.id}
                className={`
                  bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 hover:shadow-md
                  ${item.is_available ? 'border-slate-200' : 'border-rose-200 bg-rose-50/15'}
                `}
              >
                <div>
                  <div className="flex items-start gap-3">
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="text-slate-300" />
                      )}
                      {item.is_popular && (
                        <span className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] font-black px-1 rounded shadow-xs">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-extrabold text-sm text-slate-800 truncate">{item.name}</h4>
                        {/* Edit / Delete Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="تعديل المنتج"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="حذف المنتج"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {itemCat && (
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                          {itemCat.name}
                        </span>
                      )}

                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-black text-primary">
                          {item.base_price} ج.م
                        </span>
                        {item.is_popular && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                            مميز
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Availability Toggle Switch (Item 86) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1 ${item.is_available ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {item.is_available ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>متوفر للطلب</span>
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
                    title={item.is_available ? 'إيقاف توفر المنتج' : 'إتاحة توفر المنتج'}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <AlertCircle size={36} className="mx-auto mb-2 text-slate-300" />
          <p className="font-bold text-sm text-slate-600">لم يتم العثور على أي منتجات تطابق البحث أو التصنيف</p>
          <p className="text-xs text-slate-400 mt-1">يمكنك إضافة منتج جديد بالضغط على زر (+ إضافة منتج / صنف جديد)</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* Category Modal (Add / Edit)                              */}
      {/* ======================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Tag size={18} className="text-primary" />
                <span>{editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم التصنيف <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بيتزا، برجر، مشروبات..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الترتيب في القائمة
                </label>
                <input
                  type="number"
                  value={categoryOrder}
                  onChange={(e) => setCategoryOrder(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  الأرقام الأقل تظهر أولاً في قائمة العميل.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-pink-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {categorySubmitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{editingCategory ? 'حفظ التعديلات' : 'إضافة التصنيف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Item Modal (Add / Edit)                                  */}
      {/* ======================================================== */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Package size={18} className="text-primary" />
                <span>{editingItem ? 'تعديل المنتج' : 'إضافة منتج جديد للكتالوج'}</span>
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المنتج / الصنف <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: اسم المنتج أو الصنف"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>

              {/* Category & Price Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    التصنيف <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="">اختر التصنيف...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    السعر الأساسي (ج.م) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="0.00"
                    value={itemForm.base_price}
                    onChange={(e) => setItemForm({ ...itemForm, base_price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الوصف والمكونات
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: تفاصيل المنتج، المواصفات أو المكونات"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Image Upload Component */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    صورة المنتج / الصنف
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        uploadMode === 'file'
                          ? 'bg-white text-primary shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      رفع من الجهاز
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('url')}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        uploadMode === 'url'
                          ? 'bg-white text-primary shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      رابط خارجي
                    </button>
                  </div>
                </div>

                {uploadMode === 'file' ? (
                  <div>
                    {itemForm.image ? (
                      /* Image Preview Card */
                      <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2.5 flex items-center gap-3">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                          <img
                            src={itemForm.image}
                            alt="معاينة الصنف"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mb-1">
                            <CheckCircle2 size={14} />
                            <span>تم تجهيز الصورة بنجاح</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mb-2">
                            {itemForm.image}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                            >
                              <RefreshCw size={12} />
                              <span>تغيير الصورة</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={12} />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Drag & Drop Upload Zone */
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                          isDragging
                            ? 'border-primary bg-primary/5 scale-[0.99]'
                            : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50/80 bg-slate-50/40'
                        }`}
                      >
                        {isUploadingImage ? (
                          <div className="flex flex-col items-center justify-center py-2">
                            <RefreshCw size={28} className="text-primary animate-spin mb-2" />
                            <p className="text-xs font-bold text-slate-700">جارٍ رفع الصورة ومعالجتها...</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">يرجى الانتظار لحظات</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                              <UploadCloud size={24} />
                            </div>
                            <p className="text-xs font-bold text-slate-800">
                              اضغط لاختيار صورة من جهازك <span className="text-slate-400 font-normal">أو اسحبها إلى هنا</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              الصيغ المدعومة: JPG، PNG، WEBP (حجم أقصى 10 ميجابايت)
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                      accept="image/png,image/jpeg,image/webp,image/gif,image/jpg"
                      className="hidden"
                    />
                  </div>
                ) : (
                  /* URL Input Mode */
                  <div>
                    <div className="relative">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={itemForm.image}
                        onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                      {itemForm.image && (
                        <button
                          type="button"
                          onClick={() => setItemForm({ ...itemForm, image: '' })}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {itemForm.image && (
                      <div className="mt-2 flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <img
                          src={itemForm.image}
                          alt="معاينة الرابط"
                          className="w-10 h-10 rounded-md object-cover bg-slate-200"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-[11px] text-slate-500 truncate flex-1">
                          معاينة الرابط المباشر
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {imageUploadError && (
                  <p className="text-[11px] text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} />
                    <span>{imageUploadError}</span>
                  </p>
                )}
              </div>

              {/* Checkboxes */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={itemForm.is_available}
                    onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                    className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    المنتج متوفر للطلب الآن (Available)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={itemForm.is_popular}
                    onChange={(e) => setItemForm({ ...itemForm, is_popular: e.target.checked })}
                    className="rounded text-amber-500 focus:ring-amber-400 h-4 w-4 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    تمييز المنتج كصنف مفضل / شائع (Popular ★)
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={itemSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-pink-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {itemSubmitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{editingItem ? 'حفظ التعديلات' : 'إضافة المنتج'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Delete Item Confirmation Modal                           */}
      {/* ======================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-base">تأكيد حذف المنتج</h4>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف <strong>({itemToDelete.name})</strong> من القائمة نهائياً؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDeleteItem}
                disabled={deletingId === itemToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {deletingId === itemToDelete.id && <RefreshCw size={14} className="animate-spin" />}
                <span>نعم، احذف المنتج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Delete Category Confirmation Modal                       */}
      {/* ======================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-base">تأكيد حذف التصنيف</h4>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف تصنيف <strong>({categoryToDelete.name})</strong>؟ سيؤثر هذا على المنتجات المرتبطة به.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDeleteCategory}
                disabled={deletingId === categoryToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {deletingId === categoryToDelete.id && <RefreshCw size={14} className="animate-spin" />}
                <span>نعم، احذف التصنيف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
