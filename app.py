import os
import requests
from mistralai import Mistral

WEATHER_API_KEY = os.environ["WEATHER_API_KEY"]
LINE_CHANNEL_ID = os.environ["LINE_CHANNEL_ID"]
LINE_CHANNEL_ACCESS_TOKEN = os.environ["LINE_CHANNEL_ACCESS_TOKEN"]
MISTRAL_API_KEY = os.environ["MISTRAL_API_KEY"]
MISTRAL_AGENT_ID = os.environ["MISTRAL_AGENT_ID"]

weather_url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001"
weather_params = {
        "Authorization": WEATHER_API_KEY,
        "locationName": "臺北市",
    }
weather_response = requests.get(
    weather_url,
    params=weather_params,
)

with Mistral(api_key=MISTRAL_API_KEY) as client:
    agent_response = client.agents.complete(
        agent_id=MISTRAL_AGENT_ID,
        messages=[
            {"role": "user", "content": weather_response}
        ],
    )



line_url = "https://api.line.me/v2/bot/message/push"
line_headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
}
line_body =  {
    "to": LINE_CHANNEL_ID,
    "messages": [
        {
            "type": "text",
            "text": agent_response.choices[0].message.content,
        }
    ],
}
response = requests.post(line_url, json=line_body, headers=line_headers)



