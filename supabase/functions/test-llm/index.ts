import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const LLM_API_KEY = Deno.env.get('LLM_API_KEY') ?? '';

serve(async (req) => {
  const results = [];
  
  if (!LLM_API_KEY) {
    return new Response("LLM_API_KEY is not set", { status: 500 });
  }

  const modelsToTest = [
    'claude-3-5-sonnet-20240620',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-opus-20240229'
  ];

  for (const model of modelsToTest) {
    try {
      console.log(`Testing model: ${model}`);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LLM_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.push({ model, status: 'success', response: data });
      } else {
        const text = await response.text();
        results.push({ model, status: 'error', code: response.status, body: text });
      }
    } catch (err) {
      results.push({ model, status: 'exception', error: err.message });
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
