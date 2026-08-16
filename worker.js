const WEATHER_API_URL = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/agents/completions';
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function fetchWeather(env) {
  const url = `${WEATHER_API_URL}?Authorization=${encodeURIComponent(env.WEATHER_API_KEY)}&locationName=${encodeURIComponent('臺北市')}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function generateAiText(env, weatherText) {
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: env.MISTRAL_AGENT_ID,
      messages: [{ role: 'user', content: weatherText }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    throw new Error('Mistral response did not include a valid message content.');
  }

  return content;
}

async function sendLineMessage(env, aiText) {
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: env.LINE_CHANNEL_ID,
      messages: [{ type: 'text', text: aiText }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE API request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function runWeatherJob(env) {
  const weatherText = await fetchWeather(env);
  const aiText = await generateAiText(env, weatherText);
  const normalizedAiText = (aiText || '').trim();

  if (!normalizedAiText || normalizedAiText.toLowerCase() === 'nothing') {
    return new Response('No message sent.', { status: 200 });
  }

  await sendLineMessage(env, aiText);
  return new Response('Weather update sent successfully.', { status: 200 });
}

export default {
  async fetch(request, env) {
    try {
      return await runWeatherJob(env);
    } catch (error) {
      console.error(error);
      return new Response(`Failed to run weather job: ${error.message}`, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    try {
      return await runWeatherJob(env);
    } catch (error) {
      console.error(error);
      return new Response(`Scheduled job failed: ${error.message}`, { status: 500 });
    }
  },
};
