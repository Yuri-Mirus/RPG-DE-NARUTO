import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });
  const { prompt } = await req.json();
  if (typeof prompt !== 'string' || prompt.length > 800) return new Response(JSON.stringify({ error: 'Pedido inválido' }), { status: 400 });
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4.1-mini', input: `Você auxilia um RPG de ninjas em português. Crie material original para a campanha e não reproduza textos protegidos. Pedido: ${prompt}` }) });
  const result = await response.json();
  return new Response(JSON.stringify({ text: result.output_text ?? 'Não foi possível responder.' }), { headers: { 'Content-Type': 'application/json' }, status: response.ok ? 200 : 502 });
});
