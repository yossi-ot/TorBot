import { FastifyInstance } from 'fastify';

// NOTE: placeholder WhatsApp number — replace 972500000000 with the real
// demo-bot / leads number (appears in the "try the bot" button and the
// lead-form submit).
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
  html { scroll-behavior: smooth; }
  body { font-family: 'Heebo', -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a1a; line-height: 1.7; direction: rtl; background: #fff; }

  /* Shared section + buttons (design system) */
  .sec { max-width: 980px; margin: 0 auto; padding: 56px 20px; }
  .sec-title { font-size: 28px; font-weight: 800; color: #155680; text-align: center; margin-bottom: 8px; line-height: 1.3; }
  .sec-sub { text-align: center; color: #6b7280; font-size: 16px; margin-bottom: 36px; }
  .btn { display: inline-block; padding: 13px 28px; border-radius: 12px; font-weight: 700; font-size: 16px; text-decoration: none; transition: opacity .15s; border: none; cursor: pointer; font-family: inherit; }
  .btn:hover { opacity: .9; }
  .btn-primary { background: linear-gradient(135deg, #2E97D4 0%, #4CAF3E 100%); color: #fff; }
  .btn-ghost { background: #fff; color: #1F7FB8; border: 2px solid #D0EBF8; }
  .btn-wa { display: inline-flex; align-items: center; gap: 10px; background: #25D366; color: #fff; }
  .btn-wa svg { width: 22px; height: 22px; fill: #fff; }

  /* Hero */
  .hero { background: linear-gradient(135deg, #EAF6FC 0%, #fff 55%, #ECF8EA 100%); padding: 56px 20px 64px; text-align: center; }
  .mark { height: 84px; width: auto; margin: 0 auto 10px; display: block; }
  .word { font-size: 44px; font-weight: 800; letter-spacing: -1px; direction: ltr; }
  .word .tor { color: #1F7FB8; }
  .word .bot { color: #3D9131; }
  .headline { max-width: 720px; margin: 22px auto 0; font-size: 32px; font-weight: 800; color: #14304a; line-height: 1.3; }
  .lead { max-width: 600px; margin: 18px auto 0; color: #374151; font-size: 18px; }
  .cta { margin-top: 30px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  /* How it works + interactive demo */
  .how-wrap { display: flex; gap: 44px; align-items: center; justify-content: center; flex-wrap: wrap; }
  .how-text { max-width: 380px; text-align: right; }
  .how-text h3 { font-size: 23px; color: #155680; font-weight: 800; margin-bottom: 12px; line-height: 1.35; }
  .how-text p { color: #4b5563; font-size: 16px; margin-bottom: 22px; }

  /* Pain vs Solution */
  .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .col { border-radius: 16px; padding: 28px 24px; border: 1px solid; }
  .col h3 { font-size: 18px; font-weight: 800; margin-bottom: 18px; }
  .col ul { list-style: none; display: flex; flex-direction: column; gap: 14px; }
  .col li { display: flex; gap: 10px; font-size: 15px; line-height: 1.5; }
  .col .mk { flex-shrink: 0; font-weight: 800; }
  .col.bad { background: #FEF2F2; border-color: #FECACA; }
  .col.bad h3 { color: #b91c1c; }
  .col.bad .mk { color: #ef4444; }
  .col.good { background: #ECFDF3; border-color: #BBF7D0; }
  .col.good h3 { color: #15803d; }
  .col.good .mk { color: #22c55e; }

  /* Features grid */
  .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 22px; }
  .card { background: #fff; border: 1px solid #f1f1f1; border-radius: 16px; padding: 26px 22px; box-shadow: 0 1px 3px rgba(0,0,0,.04); text-align: right; }
  .card .ico { font-size: 30px; }
  .card h3 { font-size: 17px; margin: 12px 0 6px; color: #155680; }
  .card p { color: #6b7280; font-size: 14px; }

  /* Testimonial */
  .quote { max-width: 720px; margin: 0 auto; text-align: center; }
  .quote .q { font-size: 23px; font-weight: 700; color: #155680; line-height: 1.6; }
  .quote .by { margin-top: 18px; color: #6b7280; font-size: 15px; }

  /* FAQ */
  .faq { max-width: 720px; margin: 0 auto; }
  .faq details { background: #fff; border: 1px solid #eef2f7; border-radius: 12px; margin-bottom: 12px; padding: 0 18px; }
  .faq summary { cursor: pointer; font-weight: 700; color: #155680; padding: 16px 0; list-style: none; display: flex; justify-content: space-between; align-items: center; font-size: 16px; }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: '+'; color: #1F7FB8; font-size: 24px; line-height: 1; }
  .faq details[open] summary::after { content: '\\2013'; }
  .faq .ans { color: #4b5563; padding: 0 0 16px; font-size: 15px; line-height: 1.65; text-align: right; }

  /* Lead form */
  .lead-sec { background: linear-gradient(135deg, #EAF6FC, #ECF8EA); }
  .lead-card { max-width: 460px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 12px 40px rgba(21,86,128,.12); padding: 32px 28px; }
  .lead-card label { display: block; text-align: right; font-size: 14px; font-weight: 600; color: #374151; margin: 14px 0 6px; }
  .lead-card input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; font-family: inherit; direction: rtl; }
  .lead-card input:focus { outline: none; border-color: #2E97D4; box-shadow: 0 0 0 3px #D0EBF8; }
  .lead-card .btn { width: 100%; margin-top: 24px; }
  .lead-ok { display: none; text-align: center; color: #15803d; font-weight: 700; font-size: 17px; padding: 24px 0; line-height: 1.6; }

  /* Phone mockup (unchanged) */
  .phone { width: 340px; max-width: 92vw; border-radius: 26px; overflow: hidden; box-shadow: 0 16px 48px rgba(21,86,128,.18); background: #fff; border: 1px solid #e5e7eb; }
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

  .footer { border-top: 1px solid #eee; color: #9ca3af; font-size: 14px; text-align: center; padding: 28px 20px 40px; }
  .footer a { color: #1F7FB8; text-decoration: none; }

  @media (max-width: 560px) {
    .compare { grid-template-columns: 1fr; }
    .sec-title { font-size: 23px; }
    .headline { font-size: 25px; }
  }
</style>
</head>
<body>
  <section class="hero">
    <img class="mark" src="/dashboard/brand/torbot-mark.png" alt="" onerror="this.style.display='none'">
    <div class="word"><span class="tor">TOR</span><span class="bot">BOT</span></div>
    <h1 class="headline">תפסיקו לענות לשיחות בזמן עבודה.<br>תנו לבוט לסגור לכם תורים ב-WhatsApp, 24/7.</h1>
    <p class="lead">עוזר דיגיטלי חכם שמתממשק ליומן שלך, עונה ללקוחות תוך שניות, ושולח תזכורות אוטומטיות כדי למנוע הברזות.</p>
    <div class="cta">
      <a class="btn btn-primary" href="#lead">נסו את הבוט עכשיו (בחינם)</a>
      <a class="btn btn-ghost" href="/dashboard/login">התחברות</a>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-title">ככה הלקוחות שלך קובעים תור</h2>
    <p class="sec-sub">לבד, 24/7, בלי שיחת טלפון ובלי להעמיס עליך</p>
    <div class="how-wrap">
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
      <div class="how-text">
        <h3>אל תאמינו לנו, תבחנו אותו בעצמכם</h3>
        <p>בלחיצת כפתור אחת תוכלו להתכתב עם בוט דמו (של מספרה פיקטיבית) ולראות בדיוק איך החוויה עובדת עבור הלקוחות שלכם.</p>
        <a class="btn btn-wa" href="https://wa.me/972500000000" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.2-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l.8-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4.1.1.1.7-.1 1.4z"/></svg>
          לשליחת הודעה לבוט הניסיון בוואטסאפ
        </a>
      </div>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-title">איך נראים החיים שלך עם ובלי הבוט?</h2>
    <div class="compare">
      <div class="col good">
        <h3>המצב החדש (עם הבוט שלנו)</h3>
        <ul>
          <li><span class="mk">✓</span><span>יומן שמתמלא מעצמו, גם בזמן שאתם ישנים</span></li>
          <li><span class="mk">✓</span><span>אפס שיחות מבוטלות – הבוט מטפל בהכל בשקט</span></li>
          <li><span class="mk">✓</span><span>תזכורות אוטומטיות שמורידות את ההברזות ב-90%</span></li>
        </ul>
      </div>
      <div class="col bad">
        <h3>המצב היום (בלי הבוט)</h3>
        <ul>
          <li><span class="mk">✕</span><span>הודעות "היי, מתי יש תור?" ב-23:00 בלילה</span></li>
          <li><span class="mk">✕</span><span>טלפונים שמפריעים באמצע טיפול או פגישה</span></li>
          <li><span class="mk">✕</span><span>לקוחות ששוכחים להגיע (No-Show)</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-title">כל מה שהעסק שלך צריך באוטומציה מלאה</h2>
    <div class="grid4">
      <div class="card"><div class="ico">📅</div><h3>סנכרון מלא ליומן</h3><p>מתחבר ל-Google Calendar, iCal ועוד — כל תור נכנס אוטומטית ליומן שלך.</p></div>
      <div class="card"><div class="ico">⚡</div><h3>אפס התקנות</h3><p>הלקוחות כבר בוואטסאפ. אין אפליקציה להוריד ואין שום דבר ללמוד.</p></div>
      <div class="card"><div class="ico">🔁</div><h3>שימור לקוחות אוטומטי</h3><p>הבוט שולח הודעה חודש אחרי התור האחרון ומחזיר לקוחות מעצמו.</p></div>
      <div class="card"><div class="ico">💳</div><h3>סליקה מובנית</h3><p>גביית תשלום או מקדמה ישירות בצ'אט (אופציונלי).</p></div>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-title">מה אומרים בעלי עסקים שכבר עברו לאוטומט?</h2>
    <div class="quote">
      <div class="q">"מאז שהכנסתי את הבוט, כמות התורים שלי גדלה ב-30% ויש לי שעה פנויה יותר בכל יום"</div>
      <div class="by">— מיכל, בעלת קליניקה לרפואה משלימה</div>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-title">שאלות נפוצות</h2>
    <div class="faq">
      <details>
        <summary>איך מתבצעים ביטולים ושינויים?</summary>
        <div class="ans">הבוט מאפשר ללקוח לבטל או לשנות תור בלחיצת כפתור, לפי מדיניות הביטולים שתגדיר.</div>
      </details>
      <details>
        <summary>זה מתאים לטלפון שלי?</summary>
        <div class="ans">כן. הבוט עובד על כל סמארטפון, והניהול נעשה מהמחשב או מהנייד — מה שנוח לך.</div>
      </details>
      <details>
        <summary>תוך כמה זמן זה פעיל?</summary>
        <div class="ans">תהליך ההקמה מהיר — תוך ימים ספורים העסק שלך עובד באוטומט.</div>
      </details>
    </div>
  </section>

  <section class="sec lead-sec" id="lead">
    <h2 class="sec-title">הצטרפו למהפכה הדיגיטלית</h2>
    <p class="sec-sub">14 ימי ניסיון ללא התחייבות וללא צורך בכרטיס אשראי.</p>
    <div class="lead-card">
      <form id="leadForm">
        <label for="lf_name">שם מלא</label>
        <input id="lf_name" type="text" autocomplete="name" required placeholder="ישראל ישראלי">
        <label for="lf_biz">שם העסק</label>
        <input id="lf_biz" type="text" required placeholder="למשל: מספרת שרה">
        <label for="lf_phone">מספר וואטסאפ לקבלת פרטי הגישה</label>
        <input id="lf_phone" type="tel" inputmode="tel" required placeholder="050-1234567" dir="ltr">
        <button type="submit" class="btn btn-primary">אני רוצה לנסות בחינם</button>
      </form>
      <div class="lead-ok" id="leadOk">תודה! 🙌<br>קיבלנו את הפרטים ונחזור אליך בוואטסאפ עם פרטי הגישה.</div>
    </div>
  </section>

  <div class="footer">
    TorBot · יוסי אותמזגין · קצרין · <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a><br>
    <a href="/privacy">מדיניות פרטיות</a> · <a href="/terms">תנאי שימוש</a>
  </div>

  <script>
  (function () {
    var NL = String.fromCharCode(10);

    /* Animated WhatsApp booking demo (mockup) */
    var box = document.getElementById('chat');
    if (box) {
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
      var bubble = function (m) {
        var d = document.createElement('div');
        d.className = 'bubble ' + m.f;
        d.textContent = m.t.join(NL);
        box.appendChild(d);
        box.scrollTop = box.scrollHeight;
      };
      if (reduce) {
        msgs.forEach(bubble);
      } else {
        var timers = [];
        var run = function () {
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
        };
        run();
      }
    }

    /* Lead form: forward the lead to the business WhatsApp + show success.
       Replace 972500000000 with the real number (or wire to a backend/CRM). */
    var form = document.getElementById('leadForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('lf_name').value;
        var biz = document.getElementById('lf_biz').value;
        var phone = document.getElementById('lf_phone').value;
        var text = 'ליד חדש מ-TorBot:' + NL + 'שם: ' + name + NL + 'עסק: ' + biz + NL + 'וואטסאפ: ' + phone;
        form.style.display = 'none';
        document.getElementById('leadOk').style.display = 'block';
        window.open('https://wa.me/972500000000?text=' + encodeURIComponent(text), '_blank');
      });
    }
  })();
  </script>
</body>
</html>`;

export function registerLandingRoute(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    reply.type('text/html; charset=utf-8').send(LANDING_HTML);
  });
}
