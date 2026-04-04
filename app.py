import os
import requests

WEATHER_API_KEY = os.environ["WEATHER_API_KEY"]
LINE_CHANNEL_ID = os.environ["LINE_CHANNEL_ID"]
LINE_CHANNEL_ACCESS_TOKEN = os.environ["LINE_CHANNEL_ACCESS_TOKEN"]
MISTRAL_API_KEY = os.environ["MISTRAL_API_KEY"]
MISTRAL_AGENT_ID = os.environ["MISTRAL_AGENT_ID"]

weather_response = requests.get(
    "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001",
    params={
        "Authorization": WEATHER_API_KEY,
        "locationName": "臺北市",
    },
)

agent_response = requests.post(
    "https://api.mistral.ai/v1/agents/completions",
    headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
    json={
        "agent_id": MISTRAL_AGENT_ID,
        "messages": [{"role": "user", "content": weather_response.text}],
    },
)
ai_text = agent_response.json()["choices"][0]["message"]["content"]

requests.post(
    "https://api.line.me/v2/bot/message/push",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
    },
    json={
        "to": LINE_CHANNEL_ID,
        "messages": [{"type": "text", "text": ai_text}],
    },
)
