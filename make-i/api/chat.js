export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).end();
 if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'De beheerder moet de server instellen.'});
 const messages=req.body?.messages;
 if(!Array.isArray(messages)||messages.length>24||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>4000)) return res.status(400).json({error:'Ongeldig of te lang gesprek.'});
 try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:'Je bent Make I, een behulpzame AI-assistent. Antwoord in de taal van de gebruiker. Wees eerlijk over je beperkingen.'},...messages],max_completion_tokens:1200})});const d=await r.json();if(!r.ok)return res.status(502).json({error:'AI-aanvraag mislukt. Controleer API-tegoed en modelinstellingen.'});return res.json({answer:d.choices[0].message.content});}catch{return res.status(502).json({error:'Verbinding met AI mislukt.'});}
}
