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

    if (!Array.isArray(messages) || messages.length > 24 ||
        messages.some(m => !m ||
          !['user', 'assistant'].includes(m.role) ||
          typeof m.content !== 'string') ||
        JSON.stringify(messages).length > 200000) {
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
          response_format: { type: 'json_object' },
          max_completion_tokens: 8192,
          messages: [
            {
              role: 'system',
              content: `Je bent Make I, een slimme en vriendelijke AI.

Antwoord natuurlijk in de taal van de gebruiker.

Geef uitsluitend een JSON-object met answer en files.

answer bevat je normale antwoord.
files is een array met bestanden.
Elk bestand bevat name en content.

Als iemand een downloadbaar bestand vraagt, maak het volledige bestand in files.

Geef nooit instructies om code te kopiëren of handmatig op te slaan.

De website maakt automatisch echte downloadknoppen.

Geef bij bestanden alleen een korte uitleg in answer.

Maak websites bij voorkeur in één HTML-bestand.

Ondersteun HTML, CSS, JS, TXT, CSV, JSON, Python en SVG.

Ondersteun nog geen echte PDF, Word, ZIP of afbeeldingen.

Bij normale vragen is files een lege array.
Gebruik Markdown in answer wanneer nuttig.`
            },
            ...messages
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: `Groq-aanvraag mislukt (${response.status}).`
      });
    }

    if (data.choices?.[0]?.finish_reason === 'length') {
      return res.status(502).json({
        error: 'Bestand te groot. Vraag om een kleiner bestand.'
      });
    }

    const result = JSON.parse(
      data.choices[0].message.content
    );

    if (typeof result.answer !== 'string' ||
        !Array.isArray(result.files)) {
      throw new Error('Ongeldig antwoord');
    }

    const files = result.files.filter(f =>
      f &&
      typeof f.name === 'string' &&
      typeof f.content === 'string' &&
      /\.(html?|css|js|mjs|txt|csv|json|py|svg|md|xml|ts|sql|java|cpp|c|yaml|yml)$/i.test(f.name)
    ).map(f => ({
      name: f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100),
      content: f.content
    }));

    return res.json({
      answer: result.answer,
      files
    });

  } catch (error) {
    return res.status(502).json({
      error: 'AI-antwoord kon niet worden verwerkt. Probeer opnieuw.'
    });
  }
}
