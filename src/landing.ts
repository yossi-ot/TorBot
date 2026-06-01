import { FastifyInstance } from 'fastify';

const LANDING_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#2E97D4">
<title>TorBot · זימון תורים חכם ומהיר בוואטסאפ</title>
<link rel="icon" type="image/png" href="/dashboard/brand/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Heebo', -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a1a; line-height: 1.7; direction: rtl; background: #fff; }
  .hero { background: linear-gradient(135deg, #EAF6FC 0%, #fff 55%, #ECF8EA 100%); padding: 64px 20px 72px; text-align: center; }
  .mark { height: 96px; width: auto; margin: 0 auto 12px; display: block; }
  .word { font-size: 56px; font-weight: 800; letter-spacing: -1px; direction: ltr; }
  .word .tor { color: #1F7FB8; }
  .word .bot { color: #3D9131; }
  .tag { color: #6b7280; font-size: 20px; font-weight: 500; margin-top: 6px; }
  .lead { max-width: 560px; margin: 24px auto 0; color: #374151; font-size: 17px; }
  .cta { margin-top: 32px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .btn { display: inline-block; padding: 13px 28px; border-radius: 12px; font-weight: 700; font-size: 16px; text-decoration: none; transition: opacity .15s; }
  .btn:hover { opacity: .9; }
  .btn-primary { background: linear-gradient(135deg, #2E97D4 0%, #4CAF3E 100%); color: #fff; }
  .btn-ghost { background: #fff; color: #1F7FB8; border: 2px solid #D0EBF8; }
  .features { max-width: 880px; margin: 0 auto; padding: 56px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
  .card { background: #fff; border: 1px solid #f1f1f1; border-radius: 16px; padding: 28px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .card .ico { font-size: 30px; }
  .card h3 { font-size: 18px; margin: 12px 0 6px; color: #155680; }
  .card p { color: #6b7280; font-size: 15px; }
  .footer { border-top: 1px solid #eee; color: #9ca3af; font-size: 14px; text-align: center; padding: 28px 20px 40px; }
  .footer a { color: #1F7FB8; text-decoration: none; }

  /* How-it-works animated chat */
  .how { max-width: 880px; margin: 0 auto; padding: 16px 20px 8px; text-align: center; }
  .how-title { font-size: 24px; font-weight: 800; color: #155680; margin-bottom: 8px; }
  .how-sub { color: #6b7280; font-size: 15px; margin-bottom: 28px; }
  .phone { width: 340px; max-width: 92vw; margin: 0 auto; border-radius: 26px; overflow: hidden; box-shadow: 0 16px 48px rgba(21,86,128,.18); background: #fff; border: 1px solid #e5e7eb; }
  .phone-top { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: linear-gradient(135deg,#1F7FB8,#155680); color: #fff; text-align: right; }
  .phone-top .ava { width: 40px; height: 40px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; font-size: 20px; }
  .phone-top .ava img { width: 34px; height: 34px; object-fit: contain; }
  .pname { font-weight: 700; font-size: 15px; line-height: 1.2; }
  .pstat { font-size: 11px; opacity: .85; }
  .chat { height: 400px; overflow-y: auto; padding: 16px 12px; background: #ECE5DD; display: flex; flex-direction: column; gap: 8px; }
  .bubble { max-width: 82%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.55; white-space: pre-line; box-shadow: 0 1px 1px rgba(0,0,0,.08); animation: pop .3s ease both; text-align: right; }
  .bubble.u { align-self: flex-start; background: #d9fdd3; border-top-right-radius: 4px; }
  .bubble.b { align-self: flex-end; background: #fff; border-top-left-radius: 4px; }
  .typing { align-self: flex-end; background: #fff; padding: 12px 14px; border-radius: 14px; border-top-left-radius: 4px; display: flex; gap: 4px; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
  .typing span { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: blink 1.2s infinite both; }
  .typing span:nth-child(2) { animation-delay: .2s; }
  .typing span:nth-child(3) { animation-delay: .4s; }
  @keyframes pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes blink { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .bubble { animation: none; } .typing span { animation: none; } }
</style>
</head>
<body>
  <section class="hero">
    <img class="mark" src="/dashboard/brand/torbot-mark.png" alt="" onerror="this.style.display='none'">
    <div class="word"><span class="tor">TOR</span><span class="bot">BOT</span></div>
    <div class="tag">זימון תורים חכם ומהיר</div>
    <p class="lead">בוט וואטסאפ שמקבל תורים מהלקוחות שלך באופן אוטומטי, שולח תזכורות, ומנהל את היומן — בלי שיחות טלפון ובלי בלגן.</p>
    <div class="cta">
      <a class="btn btn-primary" href="/dashboard/register">רישום עסק חדש</a>
      <a class="btn btn-ghost" href="/dashboard/login">התחברות</a>
    </div>
  </section>

  <section class="how">
    <h2 class="how-title">ככה הלקוחות שלך קובעים תור</h2>
    <p class="how-sub">לבד, 24/7, בלי שיחת טלפון ובלי להעמיס עליך</p>
    <div class="phone">
      <div class="phone-top">
        <span class="ava"><img src="/dashboard/brand/torbot-mark.png" alt="" onerror="this.style.display='none';this.parentNode.textContent='🤖'"></span>
        <div>
          <div class="pname">מספרת שרה</div>
          <div class="pstat">בוט TorBot · פעיל 24/7</div>
        </div>
      </div>
      <div class="chat" id="chat" dir="rtl"></div>
    </div>
  </section>

  <section class="features">
    <div class="card">
      <div class="ico">💬</div>
      <h3>הזמנת תורים בוואטסאפ</h3>
      <p>הלקוחות כותבים בשפה חופשית, והבוט קובע להם תור פנוי לפי שעות הפעילות שלך.</p>
    </div>
    <div class="card">
      <div class="ico">⏰</div>
      <h3>תזכורות אוטומטיות</h3>
      <p>תזכורת נשלחת ללקוח לפני התור — פחות אי-הגעות, יותר הכנסה.</p>
    </div>
    <div class="card">
      <div class="ico">📊</div>
      <h3>לוח בקרה מלא</h3>
      <p>כל התורים, השירותים, שעות הפעילות והסטטיסטיקות — במקום אחד, גם מהנייד.</p>
    </div>
  </section>

  <div class="footer">
    TorBot · יוסי אותמזגין · קצרין · <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a><br>
    <a href="/privacy">מדיניות פרטיות</a> · <a href="/terms">תנאי שימוש</a>
  </div>

  <script>
  (function () {
    var NL = String.fromCharCode(10);
    var box = document.getElementById('chat');
    if (!box) return;
    var msgs = [
      { f: 'u', t: ['היי'] },
      { f: 'b', t: ['בוקר טוב! 👋 הגעת למספרת שרה.', 'אפשר לכתוב "תור" כדי לקבוע.'] },
      { f: 'u', t: ['תור'] },
      { f: 'b', t: ['מעולה! איזה שירות?', '1️⃣ תספורת גברים · 80₪', '2️⃣ תספורת + זקן · 120₪', '3️⃣ צבע · 200₪'] },
      { f: 'u', t: ['1'] },
      { f: 'b', t: ['מתי נוח לך מחר?', '🕙 10:00     🕧 12:30     🕒 15:00'] },
      { f: 'u', t: ['12:30'] },
      { f: 'b', t: ['✅ סגור! תספורת גברים מחר ב-12:30.', 'נשלח לך תזכורת שעה לפני 😊'] }
    ];
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function bubble(m) {
      var d = document.createElement('div');
      d.className = 'bubble ' + m.f;
      d.textContent = m.t.join(NL);
      box.appendChild(d);
      box.scrollTop = box.scrollHeight;
    }
    if (reduce) { msgs.forEach(bubble); return; }
    var timers = [];
    function run() {
      timers.forEach(clearTimeout); timers = [];
      box.innerHTML = '';
      var t = 500;
      msgs.forEach(function (m) {
        var len = m.t.join(' ').length;
        if (m.f === 'b') {
          timers.push(setTimeout(function () {
            var ty = document.createElement('div');
            ty.className = 'typing';
            ty.innerHTML = '<span></span><span></span><span></span>';
            box.appendChild(ty); box.scrollTop = box.scrollHeight;
          }, t));
          t += 1000;
          timers.push(setTimeout(function () {
            var ty = box.querySelector('.typing'); if (ty) ty.remove();
            bubble(m);
          }, t));
          t += Math.min(2400, 800 + len * 30);
        } else {
          t += 700;
          timers.push(setTimeout(function () { bubble(m); }, t));
          t += 450;
        }
      });
      timers.push(setTimeout(run, t + 2800));
    }
    run();
  })();
  </script>
</body>
</html>`;

export function registerLandingRoute(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    reply.type('text/html; charset=utf-8').send(LANDING_HTML);
  });
}
