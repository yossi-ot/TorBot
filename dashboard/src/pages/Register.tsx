import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';
import Logo from '../components/Logo';

export default function Register() {
  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('סיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);
    try {
      const { token } = await api.register(form);
      setToken(token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'שגיאה ברישום');
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.businessName && form.phone && form.email && form.password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm border border-gray-100">
        <div className="text-center mb-6">
          <Logo size="lg" withTagline />
          <p className="text-gray-500 text-sm mt-4">רישום עסק חדש</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם העסק</label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="למשל: מספרת שרה"
            autoFocus
          />

          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">טלפון העסק</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="050-1234567"
            dir="ltr"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">אימייל</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="your@email.com"
            dir="ltr"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">סיסמה</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="לפחות 6 תווים"
          />

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full mt-4 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'נרשם...' : 'צור חשבון'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            בלחיצה על "צור חשבון" אתה מאשר את{' '}
            <a href="/terms" target="_blank" className="hover:underline text-gray-500">תנאי השימוש</a>
            {' ו'}
            <a href="/privacy" target="_blank" className="hover:underline text-gray-500">מדיניות הפרטיות</a>
          </p>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          כבר יש לך חשבון?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
