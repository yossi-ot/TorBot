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

export default function Admin() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTenants()
      .then(setTenants)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
        <span className="text-sm text-gray-500">{tenants.length} עסקים רשומים</span>
      </div>

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
