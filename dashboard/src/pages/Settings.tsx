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
  daysUntilExpiry: number | null;
  tokenExpiring: boolean;
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

  const log = (msg: string) => {
    console.log('[WA Debug]', msg);
  };

  // Fetch Meta config from backend and initialize Facebook SDK
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    log('=== Settings v2 (auto-discover) ===');
    log('Fetching /api/whatsapp/config...');
    api.getWhatsAppConfig().then((cfg) => {
      log(`Config received: appId=${cfg.appId}, configId=${cfg.configId}`);
      metaConfigRef.current = cfg;

      const initFB = () => {
        if (!window.FB) return;
        log('Calling FB.init...');
        window.FB.init({
          appId: cfg.appId,
          autoLogAppEvents: true,
          xfbml: false,
          version: 'v21.0',
        });
        log('FB.init done, SDK ready');
        setFbReady(true);
      };

      if (window.FB) {
        log('window.FB already exists');
        initFB();
        return;
      }

      log('window.FB not found, setting fbAsyncInit + polling');
      window.fbAsyncInit = initFB;

      // Poll as fallback
      interval = setInterval(() => {
        if (window.FB) {
          clearInterval(interval);
          log('window.FB found via polling');
          initFB();
        }
      }, 500);
    }).catch((err) => {
      log(`Config fetch FAILED: ${err.message}`);
    });

    return () => { if (interval) clearInterval(interval); };
  }, []);

  // Listen for Embedded Signup message event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Log ALL messages from Facebook so we can debug
        log(`FB message: ${JSON.stringify(data).substring(0, 500)}`);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          log(`Signup event=${data.event}, data=${JSON.stringify(data.data || {})}`);
          if (data.event === 'FINISH') {
            window.__wabaSignupData = {
              wabaId: data.data?.waba_id || '',
              phoneNumberId: data.data?.phone_number_id || '',
            };
            log(`Stored signup data: waba=${data.data?.waba_id}, phone=${data.data?.phone_number_id}`);
          } else if (data.event === 'CANCEL') {
            log('User cancelled Embedded Signup flow');
          } else if (data.event === 'ERROR') {
            log(`Embedded Signup error: ${JSON.stringify(data.data)}`);
          }
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
    log(`Button clicked. FB=${!!window.FB}, config=${!!metaConfigRef.current}`);
    if (!window.FB || !metaConfigRef.current) {
      log('Aborting: FB or config missing');
      return;
    }
    setConnecting(true);
    setMessage(null);
    window.__wabaSignupData = undefined;

    log(`Calling FB.login with config_id=${metaConfigRef.current.configId}`);
    try {
    window.FB.login(
      function (response: any) {
        log(`FB.login callback fired. authResponse=${!!response.authResponse}`);
        if (!response.authResponse) {
          setConnecting(false);
          setMessage({ type: 'error', text: 'החיבור בוטל' });
          return;
        }

        const accessToken = response.authResponse.accessToken;
        log(`Got token: ${accessToken.substring(0, 20)}...`);

        // Try to get WABA data from message event, but don't require it
        const sendToBackend = (attempts: number) => {
          const signupData = window.__wabaSignupData;
          if (signupData) {
            log(`Got signup data: wabaId=${signupData.wabaId}, phoneNumberId=${signupData.phoneNumberId}`);
          } else if (attempts < 8) {
            // Wait up to 2 seconds for message event
            setTimeout(() => sendToBackend(attempts + 1), 250);
            return;
          } else {
            log('No message event data, backend will auto-discover WABA');
          }

          api.connectWhatsApp({
            accessToken,
            wabaId: signupData?.wabaId || '',
            phoneNumberId: signupData?.phoneNumberId || '',
          }).then((res: any) => {
            setWaStatus({
              connected: !res.phonePending,
              phoneNumberId: res.phoneNumberId || signupData?.phoneNumberId || '',
              wabaId: res.wabaId || signupData?.wabaId || '',
              daysUntilExpiry: 60,
              tokenExpiring: false,
            });
            if (res.phonePending) {
              setMessage({ type: 'success', text: 'WABA חובר! ממתין לרישום מספר טלפון...' });
            } else {
              setMessage({ type: 'success', text: 'WhatsApp חובר בהצלחה!' });
            }
          }).catch((err: any) => {
            log(`Connect error: ${err.message}`);
            setMessage({ type: 'error', text: err.message || 'שגיאה בחיבור WhatsApp' });
          }).finally(() => {
            setConnecting(false);
            window.__wabaSignupData = undefined;
          });
        };
        sendToBackend(0);
      },
      {
        config_id: metaConfigRef.current.configId,
        response_type: 'token',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
    log('FB.login called (no error thrown)');
    } catch (err: any) {
      log(`FB.login ERROR: ${err.message}`);
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('האם אתה בטוח שברצונך לנתק את WhatsApp?')) return;
    try {
      await api.disconnectWhatsApp();
      setWaStatus({ connected: false, phoneNumberId: null, wabaId: null, daysUntilExpiry: null, tokenExpiring: false });
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
            {waStatus.daysUntilExpiry !== null && waStatus.daysUntilExpiry <= 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 font-medium">הטוקן פג תוקף! הבוט לא פעיל.</p>
                <p className="text-xs text-red-600 mt-1">לחץ "חבר מחדש" כדי לחדש את החיבור.</p>
              </div>
            )}
            {waStatus.daysUntilExpiry !== null && waStatus.daysUntilExpiry > 0 && waStatus.daysUntilExpiry <= 7 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800 font-medium">הטוקן פג תוקף בעוד {waStatus.daysUntilExpiry} ימים</p>
                <p className="text-xs text-amber-600 mt-1">לחץ "חבר מחדש" כדי לחדש את החיבור לפני שהבוט יפסיק לעבוד.</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-sm text-gray-500" dir="ltr">
                <span className="text-gray-400">Phone Number ID:</span> {waStatus.phoneNumberId}
              </p>
              <p className="text-sm text-gray-500" dir="ltr">
                <span className="text-gray-400">WABA ID:</span> {waStatus.wabaId}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              {waStatus.tokenExpiring && (
                <button
                  onClick={launchEmbeddedSignup}
                  disabled={connecting || !fbReady}
                  className="bg-[#1877F2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
                >
                  {connecting ? 'מתחבר...' : 'חבר מחדש'}
                </button>
              )}
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                נתק WhatsApp
              </button>
            </div>
          </div>
        ) : waStatus?.wabaId ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span className="text-sm text-yellow-700 font-medium">WABA מחובר - ממתין למספר טלפון</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-500" dir="ltr">
                <span className="text-gray-400">WABA ID:</span> {waStatus.wabaId}
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              מספר הטלפון עדיין בתהליך רישום. לחץ לבדוק שוב, או נתק וחבר מחדש.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  api.getWhatsAppStatus().then((s) => {
                    setWaStatus(s);
                    if (s.connected) {
                      setMessage({ type: 'success', text: 'מספר טלפון נמצא! WhatsApp מחובר.' });
                    } else {
                      setMessage({ type: 'error', text: 'מספר טלפון עדיין לא זמין. נסה שוב מאוחר יותר.' });
                    }
                  });
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
              >
                בדוק שוב
              </button>
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-500 hover:text-red-700 transition-colors py-2"
              >
                נתק
              </button>
            </div>
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-amber-800 font-medium mb-1">משתמש ב-WhatsApp Business App?</p>
              <p className="text-xs text-amber-700">
                אם יש לך אפליקציית WhatsApp Business בטלפון, שים לב: לא ניתן להשתמש באותו מספר גם באפליקציה וגם בבוט.
                בחלון ההתחברות, בחר "צור חשבון WhatsApp חדש" והשתמש במספר טלפון אחר, או העבר את המספר הקיים (האפליקציה תפסיק לעבוד).
              </p>
            </div>
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
