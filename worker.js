const WEATHER_API_URL = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/agents/completions';
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function fetchWeather(env) {
  console.log('[fetchWeather] Starting weather API request');
  console.log('[fetchWeather] Target location: 臺北市');
  
  const url = `${WEATHER_API_URL}?Authorization=${encodeURIComponent(env.WEATHER_API_KEY)}&locationName=${encodeURIComponent('臺北市')}`;
  console.log('[fetchWeather] Request URL (without credentials): ' + WEATHER_API_URL);
  
  const response = await fetch(url);
  console.log('[fetchWeather] Response status: ' + response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchWeather] API error - Status: ${response.status}, StatusText: ${response.statusText}`);
    console.error('[fetchWeather] Error response body: ' + errorText);
    throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  console.log('[fetchWeather] Successfully fetched weather data, response length: ' + text.length + ' bytes');
  return text;
}

async function generateAiText(env, weatherText) {
  console.log('[generateAiText] Starting AI text generation');
  console.log('[generateAiText] Input weather data length: ' + weatherText.length + ' bytes');
  console.log('[generateAiText] MISTRAL_AGENT_ID exists: ' + (env.MISTRAL_AGENT_ID ? 'yes' : 'no'));
  console.log('[generateAiText] MISTRAL_API_KEY exists: ' + (env.MISTRAL_API_KEY ? 'yes' : 'no'));
  console.log('[generateAiText] Calling Mistral API');
  
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

  console.log('[generateAiText] Response status: ' + response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateAiText] API error - Status: ${response.status}, StatusText: ${response.statusText}`);
    console.error('[generateAiText] Error response body: ' + errorText);
    throw new Error(`Mistral API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[generateAiText] Response structure check: choices=' + (data?.choices ? 'present' : 'missing') + ', message=' + (data?.choices?.[0]?.message ? 'present' : 'missing'));
  
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    console.error('[generateAiText] Invalid response content type: ' + typeof content);
    throw new Error('Mistral response did not include a valid message content.');
  }

  console.log('[generateAiText] Successfully generated AI text, length: ' + content.length + ' bytes');
  return content;
}

async function sendLineMessage(env, aiText) {
  console.log('[sendLineMessage] Starting LINE message sending');
  console.log('[sendLineMessage] Message content length: ' + aiText.length + ' bytes');
  console.log('[sendLineMessage] LINE_CHANNEL_ID exists: ' + (env.LINE_CHANNEL_ID ? 'yes' : 'no'));
  console.log('[sendLineMessage] LINE_CHANNEL_ACCESS_TOKEN exists: ' + (env.LINE_CHANNEL_ACCESS_TOKEN ? 'yes' : 'no'));
  console.log('[sendLineMessage] Calling LINE API');
  
  const payload = {
    to: env.LINE_CHANNEL_ID,
    messages: [{ type: 'text', text: aiText }],
  };
  console.log('[sendLineMessage] Payload structure: to=' + (payload.to ? 'set' : 'missing') + ', messages.length=' + payload.messages.length);
  
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('[sendLineMessage] Response status: ' + response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[sendLineMessage] API error - Status: ${response.status}, StatusText: ${response.statusText}`);
    console.error('[sendLineMessage] Error response body: ' + errorText);
    throw new Error(`LINE API request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.text();
  console.log('[sendLineMessage] Successfully sent message to LINE, response length: ' + result.length + ' bytes');
  return result;
}

async function runWeatherJob(env) {
  console.log('[runWeatherJob] Job started');
  
  try {
    const weatherText = await fetchWeather(env);
    console.log('[runWeatherJob] Weather data fetched successfully');
    
    const aiText = await generateAiText(env, weatherText);
    console.log('[runWeatherJob] AI text generated successfully');
    
    const normalizedAiText = (aiText || '').trim();
    console.log('[runWeatherJob] Text normalized, final length: ' + normalizedAiText.length);

    //if (!normalizedAiText || normalizedAiText.toLowerCase() === 'nothing') {
    //  return new Response('No message sent.', { status: 200 });
    //}

    await sendLineMessage(env, aiText);
    console.log('[runWeatherJob] Job completed successfully');
    return new Response('Weather update sent successfully.', { status: 200 });
  } catch (error) {
    console.error('[runWeatherJob] Error during job execution: ' + error.message);
    throw error;
  }
}

export default {
  async fetch(request, env) {
    console.log('[fetch] HTTP request received');
    try {
      return await runWeatherJob(env);
    } catch (error) {
      console.error('[fetch] Job failed - ' + error.message);
      return new Response(`Failed to run weather job: ${error.message}`, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    console.log('[scheduled] Scheduled job triggered');
    try {
      return await runWeatherJob(env);
    } catch (error) {
      console.error('[scheduled] Job failed - ' + error.message);
      return new Response(`Scheduled job failed: ${error.message}`, { status: 500 });
    }
  },
};
