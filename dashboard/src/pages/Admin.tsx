import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, stashAdminToken } from '../api';

interface Tenant {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  users: number;
  services: number;
  appointments: number;
}

const emptyForm = { businessName: '', phone: '', email: '', password: '' };

export default function Admin() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const navigate = useNavigate();

  const loadTenants = () => {
    setLoading(true);
    api.getTenants()
      .then(setTenants)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreate = async () => {
    if (!form.businessName.trim() || !form.phone.trim() || !form.email.trim() || !form.password.trim()) {
      setCreateError('כל השדות נדרשים');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api.createTenant({
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setForm(emptyForm);
      setShowForm(false);
      loadTenants();
    } catch (err: any) {
      setCreateError(err.message || 'שגיאה ביצירת העסק');
    } finally {
      setCreating(false);
    }
  };

  const enterAsOwner = async (tenantId: string) => {
    setEnteringId(tenantId);
    try {
      const { token } = await api.impersonateTenant(tenantId);
      stashAdminToken();
      setToken(token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'שגיאה בכניסה לעסק');
      setEnteringId(null);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ניהול עסקים</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{tenants.length} עסקים רשומים</span>
          <button
            onClick={() => { setShowForm((v) => !v); setCreateError(''); }}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            {showForm ? 'ביטול' : '+ עסק חדש'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">עסק חדש</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">שם העסק</label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">טלפון</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">אימייל (להתחברות)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">סיסמה</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
          </div>
          {createError && <p className="text-sm text-red-500 mb-3">{createError}</p>}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {creating ? 'יוצר...' : 'צור עסק'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-right px-4 py-3 font-medium">שם העסק</th>
              <th className="text-right px-4 py-3 font-medium">טלפון</th>
              <th className="text-center px-4 py-3 font-medium">משתמשים</th>
              <th className="text-center px-4 py-3 font-medium">שירותים</th>
              <th className="text-center px-4 py-3 font-medium">תורים</th>
              <th className="text-right px-4 py-3 font-medium">תאריך הרשמה</th>
              <th className="text-center px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{tenant.name}</td>
                <td className="px-4 py-3 text-gray-600" dir="ltr">{tenant.phone}</td>
                <td className="px-4 py-3 text-center text-gray-600">{tenant.users}</td>
                <td className="px-4 py-3 text-center text-gray-600">{tenant.services}</td>
                <td className="px-4 py-3 text-center text-gray-600">{tenant.appointments}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(tenant.createdAt).toLocaleDateString('he-IL')}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => enterAsOwner(tenant.id)}
                    disabled={enteringId === tenant.id}
                    className="text-primary-600 hover:underline text-sm disabled:opacity-50"
                  >
                    {enteringId === tenant.id ? 'נכנס...' : 'כניסה כבעלים'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
