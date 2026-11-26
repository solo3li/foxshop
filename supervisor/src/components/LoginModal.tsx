import React, { useState } from 'react';
import { Lock, User as UserIcon, LogIn, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import type { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  canClose?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, canClose = true }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await api.login({ username, password });
    setIsLoading(false);

    if (res.data && res.data.user) {
      const allowedRoles = ['ADMIN', 'OPS_MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(res.data.user.role)) {
        api.logout();
        setError('غير مصرح لك بالدخول إلى لوحة العمليات');
        return;
      }
      onSuccess(res.data.user);
      onClose();
    } else {
      setError(res.error || 'فشل تسجيل الدخول، يرجى التأكد من البيانات');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary border border-primary-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">تسجيل دخول مشرف العمليات</h3>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المستخدم:</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                className="w-full pl-3 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary shadow-sm transition"
              />
              <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور:</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full pl-3 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary shadow-sm transition"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'جاري الدخول...' : 'دخول لوحة التحكم'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
