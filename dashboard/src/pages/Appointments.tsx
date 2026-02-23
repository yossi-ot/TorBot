import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Appointment } from '../types';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'מאושר',
  cancelled: 'בוטל',
  completed: 'הושלם',
  no_show: 'לא הגיע',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-yellow-100 text-yellow-800',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments({
        status: statusFilter || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setAppointments(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, dateFrom, dateTo]);

  const updateStatus = async (id: string, status: string) => {
    await api.updateAppointment(id, { status });
    load();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">תורים</h2>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">כל הסטטוסים</option>
          <option value="confirmed">מאושר</option>
          <option value="cancelled">בוטל</option>
          <option value="completed">הושלם</option>
          <option value="no_show">לא הגיע</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">טוען...</p>
      ) : appointments.length === 0 ? (
        <p className="text-gray-500">אין תורים להצגה</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-gray-600">תאריך</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">שעה</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">לקוח</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">טלפון</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">שירות</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">מחיר</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">סטטוס</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{formatDate(apt.startTime)}</td>
                  <td className="px-4 py-3">{formatTime(apt.startTime)}</td>
                  <td className="px-4 py-3">{apt.customer.name || '-'}</td>
                  <td className="px-4 py-3 ltr" dir="ltr">{apt.customer.phone}</td>
                  <td className="px-4 py-3">{apt.service.name}</td>
                  <td className="px-4 py-3">{apt.service.price} ₪</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {apt.status === 'confirmed' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateStatus(apt.id, 'completed')}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          הושלם
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'cancelled')}
                          className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                        >
                          בטל
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'no_show')}
                          className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100"
                        >
                          לא הגיע
                        </button>
                      </div>
                    )}
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
