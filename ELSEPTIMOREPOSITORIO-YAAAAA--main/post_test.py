import urllib.request, json
url='http://127.0.0.1:5000/api/simulate'
data=json.dumps({"meteorite":{"diameter":1000,"velocity":20,"density":3000},"location":{"lat":0,"lng":0}}).encode('utf-8')
req=urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        b=r.read()
        print('STATUS', r.status)
        print(b.decode('utf-8'))
except Exception as e:
    print('ERROR', e)
