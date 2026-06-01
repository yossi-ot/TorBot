import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm border border-gray-100">
        <div className="text-center mb-6">
          <Logo size="lg" withTagline />
          <p className="text-gray-500 text-sm mt-4">התחברות ללוח הבקרה</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="your@email.com"
            autoFocus
          />
          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="הכנס סיסמה"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full mt-4 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          אין לך חשבון?{' '}
          <Link to="/register" className="text-primary-600 hover:underline font-medium">
            הרשמה לעסק חדש
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/privacy" className="hover:underline">מדיניות פרטיות</a>
          {' · '}
          <a href="/terms" className="hover:underline">תנאי שימוש</a>
        </p>
      </div>
    </div>
  );
}
