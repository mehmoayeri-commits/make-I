export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Ongeldige aanvraag.' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Groq-sleutel ontbreekt.' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.some(m =>
      !m ||
      !['user', 'assistant'].includes(m.role) ||
      typeof m.content !== 'string'
    )) {
      return res.status(400).json({ error: 'Ongeldig gesprek.' });
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
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
              content: `Je bent Make I, een vriendelijke en slimme AI-assistent.

Geef natuurlijke, duidelijke antwoorden.
Antwoord in de taal van de gebruiker.
Gebruik Markdown voor mooie kopjes en vetgedrukte tekst.
Geef korte antwoorden op eenvoudige vragen.
Geef uitgebreide uitleg wanneer dat nodig is.
Help met rekenen, leren, schrijven en programmeren.

Wanneer iemand een downloadbaar bestand vraagt:
- Geef een korte, natuurlijke uitleg.
- Geef de volledige bestandsinhoud in een Markdown-codeblok.
- Gebruik filename=naam.ext op de openingsregel.
- Maak websites bij voorkeur in één zelfstandig HTML-bestand.
- Maak bestanden volledig af.
- Geef geen onnodige installatie-instructies.

Je kunt tekstbestanden, HTML, CSS, JavaScript, Python, CSV en JSON maken.
Je kunt nog geen echte PDF-, Word-, ZIP- of afbeeldingsbestanden maken.
Wees eerlijk over je mogelijkheden.`
            },
            ...messages.slice(-24)
          ],
          max_completion_tokens: 8192
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: `AI-aanvraag mislukt (${response.status}).`
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        error: 'Geen antwoord ontvangen. Probeer opnieuw.'
      });
    }

    return res.status(200).json({
      answer: answer + (
        data.choices[0].finish_reason === 'length'
          ? '\n\nHet antwoord is afgebroken door de AI-limiet.'
          : ''
      )
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Er is een serverfout opgetreden. Probeer opnieuw.'
    });
  }
}
