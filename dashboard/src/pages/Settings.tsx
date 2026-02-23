import { useState, useEffect } from 'react';
import { api } from '../api';

interface TenantSettings {
  name: string;
  phone: string;
  address: string;
  timezone: string;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  aiSystemPrompt: string;
  cancellationPolicy: string;
}

const emptySettings: TenantSettings = {
  name: '', phone: '', address: '', timezone: 'Asia/Jerusalem',
  whatsappPhoneNumberId: '', whatsappAccessToken: '',
  aiSystemPrompt: '', cancellationPolicy: '',
};

export default function Settings() {
  const [form, setForm] = useState<TenantSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((data) => setForm(data))
      .catch(() => setMessage({ type: 'error', text: 'שגיאה בטעינת ההגדרות' }))
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof TenantSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings(form);
      setMessage({ type: 'success', text: 'ההגדרות נשמרו בהצלחה' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'שגיאה בשמירה' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">הגדרות העסק</h1>

      {/* Business Info */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">פרטי העסק</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">שם העסק</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">טלפון</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              dir="ltr"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">כתובת</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="רחוב, עיר"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">אזור זמן</label>
            <select
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="Asia/Jerusalem">ישראל (Asia/Jerusalem)</option>
              <option value="Europe/London">לונדון (Europe/London)</option>
              <option value="America/New_York">ניו יורק (America/New_York)</option>
            </select>
          </div>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">חיבור WhatsApp</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number ID</label>
            <input
              type="text"
              value={form.whatsappPhoneNumberId}
              onChange={(e) => update('whatsappPhoneNumberId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono text-sm"
              dir="ltr"
              placeholder="מ-Meta Developer Console"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Access Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={form.whatsappAccessToken}
                onChange={(e) => update('whatsappAccessToken', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-mono text-sm pe-16"
                dir="ltr"
                placeholder="מ-Meta Developer Console"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showToken ? 'הסתר' : 'הצג'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bot Settings */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">הגדרות בוט</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">מדיניות ביטול</label>
            <textarea
              value={form.cancellationPolicy}
              onChange={(e) => update('cancellationPolicy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              rows={2}
              placeholder="למשל: ביטול עד 2 שעות לפני התור"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">הנחיות AI לבוט</label>
            <textarea
              value={form.aiSystemPrompt}
              onChange={(e) => update('aiSystemPrompt', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              rows={4}
              placeholder="הנחיות מותאמות אישית לבוט WhatsApp (אופציונלי)"
            />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
        {message && (
          <span className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
