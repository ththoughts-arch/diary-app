// api/groq.js
// Vercel Serverless Function — Groq API 프록시
// 배포 시 자동으로 https://[프로젝트명].vercel.app/api/groq 경로로 노출됨

const ALLOWED_ORIGIN = 'https://ththoughts-arch.github.io';

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await groqRes.json();
    res.status(groqRes.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
