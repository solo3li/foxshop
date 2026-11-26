import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('merchant1');
  const [password, setPassword] = useState('password123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await login({ username, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl relative z-10 border border-slate-100">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-xl shadow-primary/25 mx-auto mb-4">
            <span className="text-3xl">🦊</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">فوكس شوب | بوابة التاجر</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            لوحة تحكم وإدارة طلبات المتجر الحية
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم المستخدم (Username)
            </label>
            <div className="relative">
              <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                required
                className="w-full pr-10 pl-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              كلمة المرور (Password)
            </label>
            <div className="relative">
              <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pr-10 pl-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span>جاري التحقق...</span>
            ) : (
              <>
                <span>دخول لوحة المتجر</span>
                <ArrowLeft size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Hint */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium mb-2">
            بيانات حساب التاجر المعتمد للاختبار:
          </p>
          <div className="inline-flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-700">
            <span>المستخدم: <strong className="text-primary font-bold">merchant1</strong></span>
            <span className="hidden sm:inline">•</span>
            <span>المرور: <strong className="text-primary font-bold">password123</strong></span>
            <span className="hidden sm:inline">•</span>
            <span>الهاتف: <strong className="text-slate-600">0502222222</strong></span>
          </div>

          <button
            type="button"
            onClick={() => {
              setUsername('merchant1');
              setPassword('password123');
              login({ username: 'merchant1', password: 'password123' });
            }}
            disabled={isLoading}
            className="mt-3 w-full py-2 px-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all"
          >
            ⚡ تسجيل دخول سريع ببيانات التاجر التجريبي
          </button>
        </div>
      </div>
    </div>
  );
};
