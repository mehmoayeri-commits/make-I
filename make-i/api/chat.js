export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Groq-sleutel ontbreekt.' });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length > 24 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) ||
     typeof m.content !== 'string')) {
    return res.status(400).json({ error: 'Ongeldig gesprek.' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'Je bent Make I, een behulpzame AI-assistent. Antwoord in de taal van de gebruiker.' },
          ...messages
        ],
        max_tokens: 1200
      })
    });

    const d = await r.json();

    if (!r.ok) {
      return res.status(502).json({
        error: `Groq-aanvraag mislukt (${r.status}).`
      });
    }

    return res.json({ answer: d.choices[0].message.content });
  } catch {
    return res.status(502).json({ error: 'Verbinding met Groq mislukt.' });
  }
}
