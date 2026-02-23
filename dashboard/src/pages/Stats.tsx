import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Stats as StatsType } from '../types';

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default function Stats() {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(getMonthRange().from);
  const [dateTo, setDateTo] = useState(getMonthRange().to);

  const load = async () => {
    setLoading(true);
    try {
      setStats(await api.getStats({ from: dateFrom, to: dateTo }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  if (loading || !stats) return <p className="text-gray-500">טוען...</p>;

  const maxDaily = Math.max(...stats.dailyCounts.map(d => d.count), 1);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">סטטיסטיקות</h2>

      {/* Date range */}
      <div className="flex gap-3 mb-6">
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card label="סה״כ תורים" value={stats.totalAppointments} color="bg-gray-100 text-gray-800" />
        <Card label="מאושרים" value={stats.confirmedCount} color="bg-green-100 text-green-800" />
        <Card label="בוטלו" value={stats.cancelledCount} color="bg-red-100 text-red-800" />
        <Card label="הכנסות" value={`${stats.totalRevenue} ₪`} color="bg-emerald-100 text-emerald-800" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Popular services */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-700 mb-3">שירותים פופולריים</h3>
          {stats.popularServices.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-2">
              {stats.popularServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{s.count} תורים</span>
                    <span className="text-xs font-medium text-emerald-700">{s.revenue} ₪</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily chart */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-700 mb-3">תורים לפי יום</h3>
          {stats.dailyCounts.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {stats.dailyCounts.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{d.count}</span>
                  <div
                    className="w-full bg-emerald-400 rounded-t"
                    style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                  />
                  <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New customers */}
      <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
        <span className="text-sm text-gray-600">לקוחות חדשים בתקופה: </span>
        <span className="font-bold text-emerald-700">{stats.newCustomers}</span>
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
