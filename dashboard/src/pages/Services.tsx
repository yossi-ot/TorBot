import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Service } from '../types';

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', durationMinutes: 30, price: 0 });

  const load = async () => {
    setLoading(true);
    try {
      setServices(await api.getServices());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await api.updateService(editingId, form);
    } else {
      await api.createService(form);
    }
    resetForm();
    load();
  };

  const resetForm = () => {
    setForm({ name: '', durationMinutes: 30, price: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (s: Service) => {
    setForm({ name: s.name, durationMinutes: s.durationMinutes, price: s.price });
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleActive = async (s: Service) => {
    await api.updateService(s.id, { isActive: !s.isActive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק שירות זה?')) return;
    await api.deleteService(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">שירותים</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          + הוסף שירות
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'עריכת שירות' : 'שירות חדש'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם השירות</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">משך (דקות)</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={5}
                    step={5}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: +e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={0}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700">
                  {editingId ? 'שמור' : 'הוסף'}
                </button>
                <button type="button" onClick={resetForm} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">טוען...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-gray-600">שם</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">משך</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">מחיר</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">פעיל</th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.durationMinutes} דק'</td>
                  <td className="px-4 py-3">{s.price} ₪</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${s.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${s.isActive ? 'start-0.5' : 'start-5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(s)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                        ערוך
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">
                        מחק
                      </button>
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
