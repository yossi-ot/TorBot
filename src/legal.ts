import { FastifyInstance } from 'fastify';

const STYLE = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Heebo', -apple-system, "Segoe UI", Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 0 20px 40px; color: #1a1a1a; line-height: 1.7; direction: rtl; }
  .brand { text-align: center; padding: 32px 0 8px; }
  .brand .word { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; direction: ltr; }
  .brand .word .tor { color: #1F7FB8; }
  .brand .word .bot { color: #3D9131; }
  .brand .tag { color: #9ca3af; font-size: 13px; font-weight: 500; margin-top: 2px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  h2 { font-size: 20px; margin-top: 32px; border-bottom: 2px solid #EAF6FC; padding-bottom: 8px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
  ul { padding-right: 20px; }
  a { color: #1F7FB8; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; text-align: center; }
</style>`;

const HEADER = `<div class="brand">
  <a href="/" style="text-decoration:none">
    <div class="word"><span class="tor">TOR</span><span class="bot">BOT</span></div>
  </a>
  <div class="tag">זימון תורים חכם ומהיר</div>
</div>`;

const FOOTER = `<div class="footer">
  TorBot · יוסי אותמזגין · מיצר 31, קצרין · <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a><br>
  <a href="/privacy">מדיניות פרטיות</a> · <a href="/terms">תנאי שימוש</a> · <a href="/">דף הבית</a>
</div>`;

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מדיניות פרטיות · TorBot</title>
${STYLE}
</head>
<body>
${HEADER}
<h1>מדיניות פרטיות</h1>
<p class="meta">עודכן לאחרונה: 3 במאי 2026</p>

<p>TorBot ("השירות", "אנחנו") הוא שירות ניהול תורים בוואטסאפ עבור עסקים. השירות מופעל ע"י <strong>יוסי אותמזגין</strong>, עוסק פטור, מיצר 31, קצרין, ישראל. ניתן ליצור קשר באימייל <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a>.</p>

<h2>1. אילו נתונים אנו אוספים</h2>
<p><strong>מבעלי עסקים שנרשמים לשירות:</strong></p>
<ul>
  <li>כתובת אימייל וסיסמה (מאוחסנת מוצפנת — bcrypt)</li>
  <li>שם העסק, מספר טלפון, כתובת</li>
  <li>שעות עבודה, רשימת שירותים ומחירים</li>
  <li>אישורי גישה (Access Tokens) של WhatsApp Business — כדי לשלוח ולקבל הודעות בשם העסק</li>
</ul>
<p><strong>מלקוחות העסק שמתקשרים עם הבוט בוואטסאפ:</strong></p>
<ul>
  <li>מספר טלפון</li>
  <li>שם (כפי שמופיע בפרופיל הוואטסאפ)</li>
  <li>תוכן ההודעות שנשלחו לבוט</li>
  <li>פרטי תורים שנקבעו, בוטלו או שונו</li>
</ul>

<h2>2. למה אנו אוספים את זה</h2>
<ul>
  <li>הפעלת שירות ניהול התורים</li>
  <li>שליחת תזכורות אוטומטיות לפני התורים</li>
  <li>הצגת לוח התורים בלוח הבקרה לבעל העסק</li>
  <li>זיהוי כוונת המשתמש בשפה חופשית (זיהוי טקסט באמצעות AI)</li>
</ul>

<h2>3. עם מי אנו משתפים</h2>
<ul>
  <li><strong>Meta Platforms (WhatsApp)</strong> — כל ההודעות עוברות דרך תשתית WhatsApp Business API</li>
  <li><strong>Neon Inc.</strong> — שרתי בסיס הנתונים, ממוקמים בפרנקפורט (האיחוד האירופי)</li>
  <li><strong>Fly.io</strong> — שרתי האפליקציה, ממוקמים בפרנקפורט (האיחוד האירופי)</li>
  <li><strong>Anthropic</strong> — שירות AI לזיהוי כוונה (רק טקסט הודעה, ללא מידע מזהה נוסף; פעיל רק כשמופעל בהגדרות)</li>
</ul>
<p>איננו מוכרים מידע אישי לצדדים שלישיים. איננו מעבירים נתונים למפרסמים.</p>

<h2>4. איפה הנתונים מאוחסנים</h2>
<p>שרתי בסיס הנתונים והאפליקציה ממוקמים בפרנקפורט, גרמניה (האיחוד האירופי). הגישה לנתונים מאובטחת באמצעות HTTPS/TLS וסיסמאות חזקות. התקשרות עם בסיס הנתונים מוצפנת בתעבורה.</p>

<h2>5. תקופת שמירה</h2>
<ul>
  <li>נתוני בעל עסק פעיל — נשמרים כל עוד החשבון פעיל</li>
  <li>נתוני לקוחות שביצעו תור — נשמרים כל עוד העסק פעיל בשירות</li>
  <li>היסטוריית הודעות — עד 90 יום</li>
  <li>חשבון שנמחק — נתונים נמחקים תוך 30 יום מהבקשה</li>
</ul>

<h2>6. הזכויות שלך</h2>
<p>בהתאם לחוק הגנת הפרטיות התשמ"א-1981 ולתקנות GDPR, יש לך זכות:</p>
<ul>
  <li>לעיין בנתונים שנאספו עליך</li>
  <li>לתקן נתונים לא מדויקים</li>
  <li>לבקש מחיקת הנתונים ("הזכות להישכח")</li>
  <li>לקבל עותק של הנתונים שלך בפורמט קריא (Data portability)</li>
</ul>
<p>למימוש זכויותיך — שלח אימייל ל-<a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a>. נענה תוך 30 יום.</p>

<h2>7. עוגיות (Cookies)</h2>
<p>אנו משתמשים ב-localStorage של הדפדפן לאחסון אסימון התחברות (JWT) של בעל העסק. אין שימוש בקוקיז של צדדים שלישיים, אין מעקב פרסומי, אין Google Analytics.</p>

<h2>8. קטינים</h2>
<p>השירות מיועד לעסקים בלבד ולמשתמשים מעל גיל 18. אנו לא אוספים ביודעין נתונים על קטינים. אם נודע לנו שלקוח עסק הוא קטין, אנו נמחק את נתוניו.</p>

<h2>9. שינויים במדיניות</h2>
<p>אנו עשויים לעדכן את מדיניות הפרטיות מעת לעת. שינויים מהותיים יישלחו לבעלי העסקים באימייל לפחות 14 יום לפני כניסתם לתוקף. תאריך העדכון האחרון רשום בראש הדף.</p>

<h2>10. יצירת קשר</h2>
<p>בשאלות, בקשות לתיקון מידע או הסרה — <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a></p>

${FOOTER}
</body>
</html>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תנאי שימוש · TorBot</title>
${STYLE}
</head>
<body>
${HEADER}
<h1>תנאי שימוש</h1>
<p class="meta">עודכן לאחרונה: 3 במאי 2026</p>

<p>שירות TorBot ("השירות") מופעל ע"י <strong>יוסי אותמזגין</strong>, עוסק פטור, מיצר 31, קצרין. השימוש בשירות מהווה הסכמה לתנאים אלה.</p>

<h2>1. תיאור השירות</h2>
<p>TorBot מספק לעסקים פלטפורמה לקבלת בקשות תורים מלקוחות באמצעות וואטסאפ, ניהול לוח זמנים, ושליחת תזכורות אוטומטיות. השירות מבוסס על WhatsApp Business Cloud API של Meta.</p>

<h2>2. כשירות</h2>
<p>השירות מיועד לעסקים פעילים בישראל בלבד, עם נציג מורשה בגיל 18 ומעלה. בעת ההרשמה, אתה מצהיר שאתה מורשה לפעול בשם העסק שאתה רושם.</p>

<h2>3. רישום וחשבון</h2>
<ul>
  <li>אתה אחראי לסודיות הסיסמה שלך</li>
  <li>אתה אחראי לכל פעולה שמתבצעת מחשבונך</li>
  <li>במקרה של חשד לפריצה — הודע לנו מיידית</li>
</ul>

<h2>4. עמידה בתנאי WhatsApp</h2>
<p>השימוש בשירות כפוף לתנאי השימוש של WhatsApp Business ו-Meta. אסור לך:</p>
<ul>
  <li>לשלוח דואר זבל (spam) ללקוחות</li>
  <li>לשלוח הודעות שיווק לאנשים שלא הסכימו לקבלן</li>
  <li>להשתמש בבוט לתכנים מסחריים שאינם קשורים לעסק שלך</li>
  <li>לעבור על חוקי הגנת הפרטיות והאגנת הצרכן בישראל</li>
</ul>
<p>הפרת תנאים אלה עלולה לגרום לחסימת חשבון ה-WhatsApp שלך ע"י Meta — באחריותך הבלעדית.</p>

<h2>5. התחייבויות בעל העסק</h2>
<ul>
  <li>לעדכן את לקוחותיך בנפרד שאתה משתמש בבוט אוטומטי לקבלת תורים</li>
  <li>לקבל את הסכמת הלקוחות לאחסן את פרטיהם (טלפון, שם, היסטוריית תורים)</li>
  <li>לוודא שהמידע שאתה מזין (שעות עבודה, מחירים, מדיניות ביטולים) נכון</li>
  <li>לא להעביר את חשבונך לאחרים</li>
</ul>

<h2>6. זמינות השירות</h2>
<p>אנו עושים מאמץ לספק שירות זמין 24/7, אך לא מתחייבים לזמינות מסוימת ("uptime"). השירות עשוי להיות לא זמין מסיבות של תחזוקה, תקלות, או תלות בצדדים שלישיים (Meta, Neon, Fly.io). אנחנו לא אחראים לנזקים שייגרמו עקב השבתות.</p>

<h2>7. תמחור</h2>
<p>השירות נמצא כעת בשלב <strong>בטא — חינמי לחלוטין</strong>. אנו רשאים לשנות את מודל התמחור בעתיד, בהודעה מוקדמת של לפחות 30 יום באימייל לבעלי העסקים.</p>

<h2>8. קניין רוחני</h2>
<p>הקוד, העיצוב, הלוגו, ושם המותג של TorBot שייכים לבעל השירות. רישיון השימוש שלך אינו כולל זכות שימוש בקניין הרוחני שלנו לצרכים אחרים. כל הנתונים שאתה מזין (לקוחות, תורים, שעות) נשארים בבעלותך.</p>

<h2>9. הגבלת אחריות</h2>
<p>השירות מסופק "כפי שהוא" (AS IS), ללא כל הבטחה במפורש או במשתמע. בעל השירות לא יהיה אחראי לכל נזק ישיר, עקיף, מקרי או תוצאתי שעלול להיגרם משימוש בשירות, לרבות אך לא רק:</p>
<ul>
  <li>אובדן רווחים, לקוחות, או תורים</li>
  <li>תקלה בשליחת הודעות או תזכורות</li>
  <li>אובדן נתונים</li>
  <li>חסימה של חשבון WhatsApp ע"י Meta</li>
</ul>
<p>במקרה של חבות שלא ניתן להחריג בחוק — תקרת האחריות הכוללת לא תעלה על סכום התשלומים ששילמת בפועל לשירות בשנה האחרונה (או 0 ש"ח אם השירות חינמי).</p>

<h2>10. סיום ההתקשרות</h2>
<p>אתה רשאי לסגור את חשבונך בכל עת באמצעות שליחת אימייל אלינו או באמצעות לוח הבקרה. אנו רשאים לסגור או להשעות את חשבונך בכל עת אם:</p>
<ul>
  <li>הפרת את התנאים האלה</li>
  <li>קיים חשד לשימוש לרעה</li>
  <li>הגעה הוראה משפטית</li>
</ul>
<p>בסיום ההתקשרות — תוכל לבקש את כל הנתונים שלך, ואנו נמחק אותם תוך 30 יום.</p>

<h2>11. סמכות שיפוט</h2>
<p>תנאים אלה כפופים לחוק הישראלי. סמכות שיפוט בלעדית לבתי המשפט בישראל.</p>

<h2>12. שינויים בתנאים</h2>
<p>אנו רשאים לעדכן תנאים אלה מעת לעת. שינויים מהותיים יישלחו באימייל לפחות 14 יום לפני כניסתם לתוקף. המשך שימושך בשירות לאחר עדכון = הסכמה לתנאים החדשים.</p>

<h2>13. יצירת קשר</h2>
<p>בכל שאלה בנוגע לתנאים אלה — <a href="mailto:utmazgin@gmail.com">utmazgin@gmail.com</a></p>

${FOOTER}
</body>
</html>`;

export function registerLegalRoutes(app: FastifyInstance) {
  app.get('/privacy', async (_request, reply) => {
    reply.type('text/html; charset=utf-8').send(PRIVACY_HTML);
  });
  app.get('/terms', async (_request, reply) => {
    reply.type('text/html; charset=utf-8').send(TERMS_HTML);
  });
}
