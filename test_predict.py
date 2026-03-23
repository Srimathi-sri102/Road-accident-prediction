import requests, json

base = 'http://127.0.0.1:5050'

print('=== HEALTH CHECK ===')
r = requests.get(base + '/health')
print(r.json())

print('\n=== SAFE: Speed=40, Sunny, Dry, Urban, Low ===')
r = requests.post(base + '/predict', json={
    'speed':40,'weather':'Sunny','road_condition':'Dry',
    'time':10,'location':'Urban','traffic_density':'Low'
})
d = r.json()
risk_pct = round(d['risk_probability']*100)
print('Risk:', risk_pct, '%  |  Severity:', d['severity'])

print('\n=== DANGER: Speed=130, Snowy, Icy, Highway, High ===')
r = requests.post(base + '/predict', json={
    'speed':130,'weather':'Snowy','road_condition':'Icy',
    'time':2,'location':'Highway','traffic_density':'High'
})
d = r.json()
risk_pct = round(d['risk_probability']*100)
print('Risk:', risk_pct, '%  |  Severity:', d['severity'])
fi = [round(x, 3) for x in d['feature_importance']]
print('Feature Importance:', fi)
print('Trend:', d['severity_trend'])

print('\n=== FRONTEND ASSET CHECKS ===')
r = requests.get(base + '/')
print('/ status:', r.status_code, '| Has "RoadSafe":', 'RoadSafe' in r.text)

r2 = requests.get(base + '/style.css')
print('style.css status:', r2.status_code, '| size:', len(r2.text), 'bytes')

r3 = requests.get(base + '/script.js')
print('script.js status:', r3.status_code, '| size:', len(r3.text), 'bytes')

print('\n=== ALL DONE ===')
