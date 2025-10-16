import requests
usuario = "Diegova123"
lat = 19.43
lon = -99.13

url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json"


response = requests.get(url, headers={"User-Agent": "MiAppMeteoritos"})
if response.status_code == 200:
    data = response.json()
    print("Ciudad:", data.get("address", {}).get("city"))
    print("latitud:", data.get("lat", {}))
    print("latitud:", data.get("lon", {}))

else:
    print("Error:", response.status_code)
