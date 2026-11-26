export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.GROQ_API_KEY)
    return res.status(503).json({error: 'Groq-sleutel ontbreekt.'});

  const messages = req.body?.messages;

  if (!Array.isArray(messages) || messages.length > 24 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) ||
      typeof m.content !== 'string') ||
      JSON.stringify(messages).length > 200000)
    return res.status(400).json({error: 'Ongeldig of te lang gesprek. Begin eventueel een nieuwe chat.'});

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
        content: 'Je bent Make I, een vriendelijke, slimme AI-assistent. Geef natuurlijke, duidelijke antwoorden zoals een moderne AI-chatbot. Gebruik mooie kopjes en vetgedrukte tekst wanneer nuttig. Als iemand een downloadbaar bestand vraagt, geef een korte uitleg en de volledige inhoud in een codeblok met filename=naam.ext op de openingsregel. Maak websites bij voorkeur in één zelfstandig HTML-bestand. Geef geen onnodige instructies. Wees eerlijk over je mogelijkheden.'

          ...messages
        ],
        max_completion_tokens: 4096
      })
    });

    const d = await r.json();

    if (!r.ok)
      return res.status(502).json({
        error: `Groq-aanvraag mislukt (${r.status}).`
      });

    const answer = d.choices?.[0]?.message?.content;

    if (typeof answer !== 'string' || !answer)
      return res.status(502).json({
        error: 'Geen antwoord ontvangen.'
      });

    return res.json({
      answer: answer + (d.choices[0].finish_reason === 'length'
        ? '\n\nLet op: het antwoord is afgebroken. Vraag om een korter bestand.'
        : '')
    });

  } catch {
    return res.status(502).json({
      error: 'Verbinding met Groq mislukt.'
    });
  }
}
