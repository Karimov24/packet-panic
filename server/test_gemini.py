import os
from google import genai
from google.genai import types

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options=types.HttpOptions(timeout=60000),
)

names = []
for m in client.models.list():
    n = m.name.replace("models/", "")
    if "flash" in n and "image" not in n and "tts" not in n:
        names.append(n)
print("Flash models:", names[:12])

for n in names[:4]:
    print("Trying", n, "...")
    try:
        r = client.models.generate_content(
            model=n,
            contents="In one sentence, why is telnet risky on a firewall?",
        )
        print("OK:", r.text)
        break
    except Exception as e:
        print("FAILED:", type(e).__name__, str(e)[:120])