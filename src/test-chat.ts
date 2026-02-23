import { FastifyInstance } from 'fastify';
import { handleTestMessage } from './bot/router.js';

export function registerTestRoutes(app: FastifyInstance) {
  // Serve the test chat UI
  app.get('/test', async (request, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return TEST_HTML;
  });

  // API endpoint to simulate sending a message
  app.post('/test/send', async (request, reply) => {
    const { message, phone } = request.body as { message: string; phone: string };
    const testPhone = phone || '972501234567';

    try {
      const response = await handleTestMessage('demo-salon', testPhone, message, 'Test User');
      return { responses: [response] };
    } catch (err: any) {
      return { responses: [`שגיאה: ${err.message}`] };
    }
  });
}

const TEST_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TorBot - בדיקה מקומית</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e5ddd5;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .chat-container {
      width: 420px;
      height: 600px;
      background: #e5ddd5;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .chat-header {
      background: #075e54;
      color: white;
      padding: 12px 16px;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .chat-header .avatar {
      width: 36px; height: 36px;
      background: #25d366;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .message {
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message.user {
      align-self: flex-end;
      background: #dcf8c6;
      border-top-left-radius: 8px;
      border-top-right-radius: 0;
    }
    .message.bot {
      align-self: flex-start;
      background: white;
      border-top-right-radius: 8px;
      border-top-left-radius: 0;
    }
    .input-area {
      display: flex;
      padding: 8px;
      background: #f0f0f0;
      gap: 8px;
    }
    .input-area input {
      flex: 1;
      padding: 10px 14px;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      outline: none;
    }
    .input-area button {
      width: 42px; height: 42px;
      background: #075e54;
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
    }
    .input-area button:hover { background: #128c7e; }
    .typing { color: #999; font-style: italic; font-size: 12px; padding: 4px 12px; }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <div class="avatar">💈</div>
      <div>
        <div>מספרת שרה</div>
        <div style="font-size: 11px; font-weight: normal; opacity: 0.8">בוט תורים - בדיקה מקומית</div>
      </div>
    </div>
    <div class="messages" id="messages">
      <div class="message bot">שלח הודעה כדי להתחיל! נסה "היי" או "תור"</div>
    </div>
    <div class="input-area">
      <input type="text" id="input" placeholder="הקלד הודעה..." autofocus />
      <button onclick="send()">▶</button>
    </div>
  </div>
  <script>
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');

    input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      // Add user message
      addMessage(text, 'user');

      // Show typing indicator
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.textContent = 'מקליד...';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;

      try {
        const res = await fetch('/test/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, phone: '972501234567' })
        });
        const data = await res.json();

        typing.remove();

        if (data.responses && data.responses.length > 0) {
          for (const r of data.responses) {
            addMessage(r, 'bot');
          }
        } else {
          addMessage('(אין תשובה)', 'bot');
        }
      } catch (err) {
        typing.remove();
        addMessage('שגיאה: ' + err.message, 'bot');
      }
    }

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
  </script>
</body>
</html>`;
