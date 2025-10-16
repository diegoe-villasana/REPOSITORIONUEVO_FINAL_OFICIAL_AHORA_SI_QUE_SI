from app import app
import json

client = app.test_client()

payload = {"meteorite": {"diameter": 1000, "velocity": 20, "density": 3000}, "location": {"lat": 0, "lng": 0}}
resp = client.post('/api/simulate', json=payload)
print('STATUS', resp.status_code)
try:
    print(json.dumps(resp.get_json(), indent=2, ensure_ascii=False))
except Exception as e:
    print('RAW', resp.get_data(as_text=True))
    print('ERROR', e)
