import { useState, useEffect } from 'react';
import { api } from '../api';
import type { WorkingHour, BlockedSlot } from '../types';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface DayRow {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

export default function WorkingHours() {
  const [days, setDays] = useState<DayRow[]>(
    DAYS.map((_, i) => ({ dayOfWeek: i, isActive: false, startTime: '09:00', endTime: '18:00' }))
  );
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockForm, setBlockForm] = useState({ startDatetime: '', endDatetime: '', reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [hours, blocks] = await Promise.all([
        api.getWorkingHours(),
        api.getBlockedSlots(),
      ]);

      // Merge with default days grid
      const merged = DAYS.map((_, i) => {
        const existing = hours.find((h: WorkingHour) => h.dayOfWeek === i);
        return existing
          ? { dayOfWeek: i, isActive: existing.isActive, startTime: existing.startTime, endTime: existing.endTime }
          : { dayOfWeek: i, isActive: false, startTime: '09:00', endTime: '18:00' };
      });
      setDays(merged);
      setBlockedSlots(blocks);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateDay = (index: number, updates: Partial<DayRow>) => {
    setDays(days.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      await api.updateWorkingHours(days.filter(d => d.isActive));
      await load();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createBlockedSlot(blockForm);
    setBlockForm({ startDatetime: '', endDatetime: '', reason: '' });
    setShowBlockForm(false);
    load();
  };

  const removeBlock = async (id: string) => {
    await api.deleteBlockedSlot(id);
    load();
  };

  if (loading) return <p className="text-gray-500">טוען...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">שעות פעילות</h2>

      {/* Working hours grid */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="space-y-2">
          {days.map((day, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <button
                onClick={() => updateDay(i, { isActive: !day.isActive })}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${day.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${day.isActive ? 'start-0.5' : 'start-5'}`} />
              </button>
              <span className="w-16 text-sm font-medium">{DAYS[i]}</span>
              {day.isActive ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => updateDay(i, { startTime: e.target.value })}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => updateDay(i, { endTime: e.target.value })}
                    className="px-2 py-1 border rounded text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">סגור</span>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={saveHours}
          disabled={saving}
          className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'שומר...' : 'שמור שעות'}
        </button>
      </div>

      {/* Blocked Slots */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">חסימות זמנים</h3>
        <button
          onClick={() => setShowBlockForm(true)}
          className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"
        >
          + הוסף חסימה
        </button>
      </div>

      {showBlockForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">חסימת זמן חדשה</h3>
            <form onSubmit={addBlock} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">התחלה</label>
                <input
                  type="datetime-local"
                  value={blockForm.startDatetime}
                  onChange={(e) => setBlockForm({ ...blockForm, startDatetime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיום</label>
                <input
                  type="datetime-local"
                  value={blockForm.endDatetime}
                  onChange={(e) => setBlockForm({ ...blockForm, endDatetime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיבה</label>
                <input
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="חופשה, אירוע..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700">
                  הוסף חסימה
                </button>
                <button type="button" onClick={() => setShowBlockForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {blockedSlots.length === 0 ? (
        <p className="text-gray-400 text-sm">אין חסימות</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-gray-600">התחלה</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">סיום</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">סיבה</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blockedSlots.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(b.startDatetime).toLocaleString('he-IL')}</td>
                  <td className="px-4 py-3">{new Date(b.endDatetime).toLocaleString('he-IL')}</td>
                  <td className="px-4 py-3">{b.reason || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeBlock(b.id)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                    >
                      מחק
                    </button>
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
