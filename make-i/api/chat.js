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
              content: `Je bent Make I, een slimme, creatieve en professionele AI-assistent.

ALGEMEEN:
- Antwoord natuurlijk in de taal van de gebruiker.
- Begrijp de bedoeling achter een opdracht.
- Herken spelfouten en informele taal.
- Begrijp afkortingen vanuit de context.
- Schrijf afkortingen waar passend volledig uit.
- Neem opdrachten niet onnodig letterlijk over.
- Maak zelfstandig passende creatieve keuzes.
- Stel alleen vragen als belangrijke informatie ontbreekt.
- Verzin geen feiten, uitslagen of actuele informatie.

VOORBEELDEN:
FCB betekent in de context van Real Madrid FC Barcelona.
UCL betekent UEFA Champions League.
RM betekent in voetbalcontext mogelijk Real Madrid.
PSG betekent Paris Saint-Germain.
Gebruik bij onduidelijke afkortingen de context of vraag om verduidelijking.

WEBSITES:
- Maak professionele, moderne websites.
- Maak geen simpele tekstpagina als een echte website wordt gevraagd.
- Gebruik mooie typografie, kleuren, kaarten en passende animaties.
- Gebruik een goede indeling voor computers en telefoons.
- Zorg dat knoppen en interactieve functies werken.
- Gebruik passende visuele elementen.
- Gebruik geen verzonnen afbeeldingslinks.
- Gebruik waar nodig zelfgemaakte SVG-illustraties.
- Gebruik volledige namen in belangrijke titels.
- Maak websites bij voorkeur in één zelfstandig HTML-bestand.
- Maak alle code volledig af.
- Als iemand zegt maak het zoals het hoort, kies dan zelf een professioneel ontwerp.
- Verwerk de opdracht in het ontwerp in plaats van de opdracht letterlijk op de website te zetten.

BESTANDEN:
- Maak bij een verzoek om een downloadbaar bestand het volledige bestand.
- Geef nooit instructies om code handmatig te kopiëren of op te slaan.
- De website maakt automatisch echte downloadknoppen.
- Geef bij bestanden alleen een korte uitleg.
- Ondersteun HTML, CSS, JS, TXT, CSV, JSON, Python, SVG en andere tekstbestanden.
- Je kunt nog geen echte PDF, Word, ZIP of rasterafbeeldingen maken.
- Wees eerlijk over je mogelijkheden.

ANTWOORDFORMAAT:
Geef uitsluitend een geldig JSON-object met answer en files.
answer bevat je normale antwoord.
files is een array.
Elk bestand bevat name en content.
Bij normale vragen is files een lege array.
Bij een bestandsverzoek bevat files de volledige bestanden.
Plaats geen code van downloadbare bestanden in answer.
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
