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
</body>
</html>`;

export function registerLandingRoute(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    reply.type('text/html; charset=utf-8').send(LANDING_HTML);
  });
}
