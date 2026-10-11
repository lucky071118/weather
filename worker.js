const WEATHER_API_URL = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001';
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

async function fetchWeather(env) {
  const url = new URL(WEATHER_API_URL);
  url.searchParams.set('Authorization', env.WEATHER_API_KEY);
  url.searchParams.set('locationName', '臺北市');
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function generateWeatherAlert(weatherData, now) {
  const elements = weatherData.records.location
    .find((location) => location.locationName === '臺北市').weatherElement;
  const end = now + 18 * 60 * 60 * 1000;
  const values = (name) => elements.find((element) => element.elementName === name)
    .time
    .filter((period) => {
      const start = Date.parse(`${period.startTime.replace(' ', 'T')}+08:00`);
      const finish = Date.parse(`${period.endTime.replace(' ', 'T')}+08:00`);
      return start < end && finish > now;
    })
    .map((period) => Number(period.parameter.parameterName));
  const alerts = [];
  if (values('MinT').some((temperature) => temperature < 10)) {
    alerts.push('有低溫，得穿厚外套');
  }
  if (values('PoP').some((probability) => probability >= 40)) {
    alerts.push('有下雨，得攜帶雨傘');
  }
  return alerts.join('\n');
}

async function sendLineMessage(env, weatherText) {
  const groupId = env.LINE_GROUP_ID?.trim();
  const payload = {
    to: groupId,
    messages: [{ type: 'text', text: weatherText }],
  };
  
  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`LINE API request failed: ${response.status} ${response.statusText}`);
  }
}

async function runWeatherJob(env, now = Date.now()) {
  if (!env.LINE_GROUP_ID?.trim()) {
    return new Response('LINE_GROUP_ID is not configured; skipped.', { status: 200 });
  }

  const weatherData = await fetchWeather(env);
  const weatherText = generateWeatherAlert(weatherData, now);
  if (!weatherText) {
    return new Response('No alert conditions met; no message sent.', { status: 200 });
  }

  await sendLineMessage(env, weatherText);
  return new Response('Weather update sent successfully.', { status: 200 });
}

async function handleJob(env, now) {
  try {
    return await runWeatherJob(env, now);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Failed to run weather job: ${message}`, { status: 500 });
  }
}

export default {
  async fetch(_request, env) {
    return handleJob(env, Date.now());
  },

  async scheduled(controller, env) {
    return handleJob(env, controller.scheduledTime);
  },
};
