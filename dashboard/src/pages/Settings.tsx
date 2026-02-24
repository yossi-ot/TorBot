import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
    __wabaSignupData?: { wabaId: string; phoneNumberId: string };
  }
}

interface TenantSettings {
  name: string;
  phone: string;
  address: string;
  timezone: string;
  aiSystemPrompt: string;
  cancellationPolicy: string;
}

interface WhatsAppStatus {
  connected: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
}

const emptySettings: TenantSettings = {
  name: '', phone: '', address: '', timezone: 'Asia/Jerusalem',
  aiSystemPrompt: '', cancellationPolicy: '',
};

export default function Settings() {
  const [form, setForm] = useState<TenantSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const metaConfigRef = useRef<{ appId: string; configId: string } | null>(null);

  // Fetch Meta config from backend and initialize Facebook SDK
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    api.getWhatsAppConfig().then((cfg) => {
      metaConfigRef.current = cfg;

      const initFB = () => {
        if (!window.FB) return;
        window.FB.init({
          appId: cfg.appId,
          autoLogAppEvents: true,
          xfbml: false,
          version: 'v21.0',
        });
        setFbReady(true);
      };

      if (window.FB) {
        initFB();
        return;
      }

      window.fbAsyncInit = initFB;

      // Poll as fallback
      interval = setInterval(() => {
        if (window.FB) {
          clearInterval(interval);
          initFB();
        }
      }, 500);
    }).catch((err) => {
      console.error('Failed to load Meta config:', err);
    });

    return () => { if (interval) clearInterval(interval); };
  }, []);

  // Listen for Embedded Signup message event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          window.__wabaSignupData = {
            wabaId: data.data.waba_id,
            phoneNumberId: data.data.phone_number_id,
          };
        }
      } catch {
        // Ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load settings + WhatsApp status
  useEffect(() => {
    Promise.all([
      api.getSettings().then(setForm),
      api.getWhatsAppStatus().then(setWaStatus),
    ])
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

  const launchEmbeddedSignup = useCallback(() => {
    if (!window.FB || !metaConfigRef.current) return;
    setConnecting(true);
    setMessage(null);
    window.__wabaSignupData = undefined;

    window.FB.login(
      async (response: any) => {
        if (!response.authResponse) {
          setConnecting(false);
          setMessage({ type: 'error', text: 'החיבור בוטל' });
          return;
        }

        const code = response.authResponse.code;

        // Wait briefly for message event if not yet received
        let attempts = 0;
        while (!window.__wabaSignupData && attempts < 20) {
          await new Promise((r) => setTimeout(r, 250));
          attempts++;
        }

        const signupData = window.__wabaSignupData;
        if (!signupData) {
          setConnecting(false);
          setMessage({ type: 'error', text: 'לא התקבלו נתוני WhatsApp Business' });
          return;
        }

        try {
          await api.connectWhatsApp({
            code,
            wabaId: signupData.wabaId,
            phoneNumberId: signupData.phoneNumberId,
          });
          setWaStatus({
            connected: true,
            phoneNumberId: signupData.phoneNumberId,
            wabaId: signupData.wabaId,
          });
          setMessage({ type: 'success', text: 'WhatsApp חובר בהצלחה!' });
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || 'שגיאה בחיבור WhatsApp' });
        } finally {
          setConnecting(false);
          window.__wabaSignupData = undefined;
        }
      },
      {
        config_id: metaConfigRef.current.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('האם אתה בטוח שברצונך לנתק את WhatsApp?')) return;
    try {
      await api.disconnectWhatsApp();
      setWaStatus({ connected: false, phoneNumberId: null, wabaId: null });
      setMessage({ type: 'success', text: 'WhatsApp נותק' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'שגיאה בניתוק' });
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

      {/* WhatsApp Embedded Signup */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">חיבור WhatsApp</h2>

        {waStatus?.connected ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
              <span className="text-sm text-emerald-700 font-medium">מחובר</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-sm text-gray-500" dir="ltr">
                <span className="text-gray-400">Phone Number ID:</span> {waStatus.phoneNumberId}
              </p>
              <p className="text-sm text-gray-500" dir="ltr">
                <span className="text-gray-400">WABA ID:</span> {waStatus.wabaId}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              נתק WhatsApp
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              חבר את חשבון WhatsApp Business שלך כדי שהבוט יוכל לקבל ולשלוח הודעות ללקוחות.
            </p>
            <button
              onClick={launchEmbeddedSignup}
              disabled={connecting || !fbReady}
              className="bg-[#1877F2] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
            >
              {connecting ? 'מתחבר...' : 'חבר עם Facebook'}
            </button>
            {!fbReady && (
              <p className="text-xs text-gray-400 mt-2">טוען Facebook SDK...</p>
            )}
          </div>
        )}
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
