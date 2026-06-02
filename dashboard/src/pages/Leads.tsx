import { useState, useEffect } from 'react';
import { api } from '../api';

interface Lead {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  source: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'חדש',
  contacted: 'נוצר קשר',
  converted: 'הומר ללקוח',
  rejected: 'נדחה',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-primary-100 text-primary-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-accent-100 text-accent-800',
  rejected: 'bg-gray-100 text-gray-600',
};

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '972');
  return `https://wa.me/${digits}`;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    api.getLeads()
      .then(setLeads)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.updateLeadStatus(id, status);
    } catch {
      load(); // revert to server state on failure
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;

  const newCount = leads.filter((l) => l.status === 'new').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">לידים</h1>
        <span className="text-sm text-gray-500">{leads.length} סה״כ · {newCount} חדשים</span>
      </div>

      {leads.length === 0 ? (
        <p className="text-gray-500">עדיין אין לידים. כשמישהו ימלא את הטופס בדף הנחיתה, הוא יופיע כאן.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-start px-4 py-3 font-medium">שם</th>
                <th className="text-start px-4 py-3 font-medium">עסק</th>
                <th className="text-start px-4 py-3 font-medium">וואטסאפ</th>
                <th className="text-start px-4 py-3 font-medium">תאריך</th>
                <th className="text-start px-4 py-3 font-medium">סטטוס</th>
                <th className="text-start px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.businessName}</td>
                  <td className="px-4 py-3">
                    <a href={waLink(lead.phone)} target="_blank" rel="noopener" className="text-primary-600 hover:underline" dir="ltr">
                      {lead.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(lead.createdAt).toLocaleDateString('he-IL')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || ''}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setStatus(lead.id, 'contacted')} className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">נוצר קשר</button>
                      <button onClick={() => setStatus(lead.id, 'converted')} className="text-xs px-2 py-1 bg-accent-50 text-accent-700 rounded hover:bg-accent-100">הומר</button>
                      <button onClick={() => setStatus(lead.id, 'rejected')} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">נדחה</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
