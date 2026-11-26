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
          {
            role: 'system',
            content: 'Je bent Make I, een behulpzame AI-assistent. Antwoord in de taal van de gebruiker. Als iemand een bestand vraagt, geef de volledige inhoud in een Markdown-codeblok. Zet op de openingsregel de taal en filename=naam.ext, bijvoorbeeld ```html filename=index.html. Sluit elk blok af met drie backticks op een aparte regel. Gebruik aparte blokken voor aparte bestanden. De website maakt hiervan downloadknoppen. Je kunt alleen tekstgebaseerde bestanden maken, geen echte PDF, Word, ZIP of afbeeldingen. Zeg eerlijk als een bestand te groot is.'
          },
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
