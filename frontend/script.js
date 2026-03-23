/* =============================================
   RoadSafe AI – Enhanced Script
   All features: prediction, map, history, stats
   ============================================= */

const API_BASE = '';   // same origin (Flask serves both)

let importanceChart = null;
let trendChart      = null;
let map             = null;
let allMarkers      = [];
let predHistory     = JSON.parse(localStorage.getItem('rs_history') || '[]');
let sessionStats    = { count: 0, riskSum: 0, highRisk: 0, lastSev: '—' };
let voiceEnabled    = false;

// ------- Helpers -------
const $ = id => document.getElementById(id);

function showToast(msg, type = 'info') {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show';
    t.style.borderLeftColor = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6';
    t.style.borderLeftWidth = '3px';
    setTimeout(() => t.classList.remove('show'), 3000);
}

function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

function getTrafficVal() {
    return document.querySelector('input[name="traffic"]:checked')?.value || 'Medium';
}

// ------- Navigation -------
function initNav() {
    ['dashboard','map','history', 'metrics'].forEach(pg => {
        $(  'nav-' + pg).addEventListener('click', () => switchPage(pg));
    });
    $('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
}

function switchPage(pg) {
    ['dashboard','map','history', 'metrics'].forEach(p => {
        $('page-' + p)?.classList.toggle('active', p === pg);
        $('nav-' + p)?.classList.toggle('active', p === pg);
    });
    $('page-title').textContent = { dashboard:'Live Risk Dashboard', map:'Accident Hotspot Map', history:'Prediction History', metrics: 'Model Performance' }[pg];
    $('page-sub').textContent = { dashboard:'Configure road conditions and run the ML analysis.', map:'View high-risk zones and traffic density across the region.', history:'All recent predictions made in this session.', metrics: 'Evaluation metrics on the test dataset.' }[pg];
    if (pg === 'map' && !map) initMap();
    if (pg === 'map' && map) setTimeout(() => map.invalidateSize(), 100);
}

// ------- Server health check -------
async function checkServer() {
    try {
        const res = await fetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speed:60, weather:'Sunny', road_condition:'Dry', time:12, location:'Urban', traffic_density:'Low' }) });
        if (res.ok || res.status === 200) { setServerOnline(true); }
        else { setServerOnline(false); }
    } catch { setServerOnline(false); }
}

function setServerOnline(online) {
    const dot = $('server-dot');
    const label = $('server-label');
    const badge = $('connection-status');
    if (online) {
        dot.className = 'pulse-dot online';
        label.textContent = 'Backend Online';
        badge.className = 'status-badge online';
        badge.textContent = '● Online';
    } else {
        dot.className = 'pulse-dot offline';
        label.textContent = 'Backend Offline';
        badge.className = 'status-badge offline';
        badge.textContent = '● Offline';
        showToast('⚠️ Backend not reachable. Please start the Flask server.', 'error');
    }
}

// ------- Charts -------
function initCharts() {
    const chartDefaults = {
        color: '#64748b',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(13,21,32,0.95)', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(59,130,246,0.2)', borderWidth: 1 } }
    };
    Chart.defaults.color = '#64748b';

    importanceChart = new Chart($('importanceChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Speed', 'Time', 'Weather', 'Road', 'Location', 'Traffic'],
            datasets: [{ label: 'Feature Weight', data: [0,0,0,0,0,0], backgroundColor: ['rgba(59,130,246,0.7)','rgba(59,130,246,0.5)','rgba(59,130,246,0.6)','rgba(59,130,246,0.5)','rgba(59,130,246,0.4)','rgba(59,130,246,0.5)'], borderRadius: 5, borderSkipped: false }]
        },
        options: { ...chartDefaults, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } } } }
    });

    trendChart = new Chart($('trendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: ['T-5','T-4','T-3','T-2','T-1','Now'],
            datasets: [{
                label: 'Severity Level',
                data: [0,0,0,0,0,0],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.08)',
                fill: true, tension: 0.45, pointRadius: 4,
                pointBackgroundColor: '#ef4444', pointBorderColor: '#080d13', pointBorderWidth: 2
            }]
        },
        options: { ...chartDefaults, scales: { y: { min: 0, max: 2, ticks: { callback: v => ['Low','Med','High'][v] || '', color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } }
    });
}

// ------- Map -------
const HOTSPOTS = [
    { lat:13.085, lng:80.210, type:'critical', name:'Inner Ring Road',      desc:'Frequent rear-end collisions',    risk:82 },
    { lat:13.042, lng:80.233, type:'elevated', name:'Mount Road Junction',   desc:'High pedestrian crossings',       risk:55 },
    { lat:13.120, lng:80.262, type:'traffic',  name:'Central Transit Hub',   desc:'Evening peak traffic bottleneck', risk:40 },
    { lat:13.014, lng:80.183, type:'critical', name:'Poonamalle Highway',    desc:'High-speed corridor accidents',   risk:78 },
    { lat:13.063, lng:80.252, type:'elevated', name:'Velachery Road',        desc:'Waterlogging during rains',       risk:62 },
    { lat:13.100, lng:80.215, type:'safe',     name:'Anna Nagar Residential',desc:'Low traffic, well-lit roads',     risk:12 },
    { lat:12.980, lng:80.240, type:'traffic',  name:'OMR Tech Corridor',     desc:'Heavy IT commute traffic',        risk:48 },
    { lat:13.055, lng:80.200, type:'critical', name:'Koyambedu Interchange', desc:'Multi-lane merge accidents',      risk:74 },
];

function colorForType(type) {
    return { critical:'#ef4444', elevated:'#f59e0b', traffic:'#3b82f6', safe:'#22c55e' }[type] || '#64748b';
}

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([13.0627, 80.2363], 12);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com">CartoDB</a>',
        maxZoom: 19
    }).addTo(map);

    renderMarkers('all');

    ['btn-all','btn-risk','btn-traffic'].forEach(id => {
        $(id).addEventListener('click', () => {
            document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
            $(id).classList.add('active');
            const filter = id === 'btn-all' ? 'all' : id === 'btn-risk' ? 'risk' : 'traffic';
            renderMarkers(filter);
        });
    });
}

function renderMarkers(filter) {
    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];

    const filtered = HOTSPOTS.filter(h => {
        if (filter === 'risk') return ['critical','elevated'].includes(h.type);
        if (filter === 'traffic') return h.type === 'traffic';
        return true;
    });

    filtered.forEach(spot => {
        const color = colorForType(spot.type);
        const circle = L.circle([spot.lat, spot.lng], {
            color, fillColor: color, fillOpacity: 0.3,
            radius: spot.type === 'critical' ? 600 : 400,
            weight: 2
        }).addTo(map);

        const innerDot = L.circleMarker([spot.lat, spot.lng], {
            radius: 7, color, fillColor: color, fillOpacity: 1, weight: 2
        }).addTo(map);

        const riskLabel = spot.risk > 65 ? '🔴 Critical' : spot.risk > 40 ? '🟡 Elevated' : '🟢 Safe';
        const popup = `
            <b>${spot.name}</b><br/>
            <small style="color:#94a3b8">${spot.desc}</small><br/>
            <hr style="border-color:rgba(59,130,246,0.15);margin:6px 0"/>
            <span style="font-size:0.8rem">Risk Score: <b style="color:${color}">${spot.risk}%</b></span><br/>
            <span style="font-size:0.8rem">${riskLabel}</span>
        `;
        circle.bindPopup(popup);
        innerDot.bindPopup(popup);
        allMarkers.push(circle, innerDot);
    });
}

function setupSearch() {
    const doSearch = async () => {
        const q = $('map-search').value.trim();
        if (!q) return;
        if (!map) { switchPage('map'); await new Promise(r => setTimeout(r, 400)); }

        // Match against a hotspot name (local)
        const match = HOTSPOTS.find(h => h.name.toLowerCase().includes(q.toLowerCase()));
        if (match) {
            switchPage('map');
            setTimeout(() => {
                map.invalidateSize();
                map.flyTo([match.lat, match.lng], 15, { duration: 1.2 });
                showToast(`📍 Found: ${match.name}`, 'success');
                if (match.type === 'critical' || match.type === 'elevated') {
                    document.getElementById('location').value = 'Urban';
                } else if (match.name.toLowerCase().includes('highway')) {
                    document.getElementById('location').value = 'Highway';
                }
            }, 300);
            return;
        }

        // Nominatim geocoding fallback
        try {
            showToast('🔍 Searching location…');
            let searchQ = q;
            if (!searchQ.includes(',')) searchQ += ', Chennai, India';
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQ)}&format=json&limit=1`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const places = await res.json();
            if (places.length) {
                const pl = places[0];
                switchPage('map');
                setTimeout(() => {
                    map.invalidateSize();
                    map.flyTo([pl.lat, pl.lon], 14, { duration: 1.5 });
                    L.popup().setLatLng([pl.lat, pl.lon]).setContent(`<b>${pl.display_name.split(',')[0]}</b>`).openOn(map);
                    showToast(`📍 ${pl.display_name.split(',')[0]}`, 'success');
                }, 300);
            } else {
                showToast('Location not found. Try a different query.', 'error');
            }
        } catch { showToast('Search failed. Check internet connection.', 'error'); }
    };

    $('search-btn').addEventListener('click', doSearch);
    $('map-search').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
}

// ------- Smart Routing Engine -------
let currentRouteLayer = null;

async function geocode(query) {
    let q = query;
    if (!q.includes(',')) q += ', Chennai, India';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) throw new Error('Location not found');
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

async function findSmartRoute() {
    const startQ = $('route-start').value.trim();
    const endQ = $('route-end').value.trim();
    if (!startQ || !endQ) { showToast('⚠️ Please enter both Start and End locations', 'error'); return; }

    try {
        if (!map) { switchPage('map'); await new Promise(r => setTimeout(r, 400)); }
        $('calc-route-btn').textContent = 'Loading...';
        showToast('📍 Getting GPS coordinates...', 'info');
        
        const [startLat, startLon] = await geocode(startQ);
        const [endLat, endLon] = await geocode(endQ);

        showToast('🛣️ Calculating Route Path...', 'info');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
        
        const res = await fetch(osrmUrl);
        const routeData = await res.json();

        if (routeData.code !== 'Ok') throw new Error('Route calculation failed');

        if (currentRouteLayer) map.removeLayer(currentRouteLayer);
        
        const coords = routeData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON is lon,lat -> Leaflet needs lat,lon
        
        // Draw the Base Route Line
        currentRouteLayer = L.polyline(coords, {
            color: '#3b82f6', weight: 6, opacity: 0.8,
            dashArray: '10, 10', dashOffset: '0', 
            className: 'neon-route' // You can style this in CSS
        }).addTo(map);

        // Add markers for Start and End
        const startIcon = L.divIcon({ html: '<div style="font-size:24px;filter:drop-shadow(0 0 10px #22c55e);">🟢</div>', className: 'clear-icon', iconSize: [24,24] });
        const endIcon = L.divIcon({ html: '<div style="font-size:24px;filter:drop-shadow(0 0 10px #ef4444);">🚩</div>', className: 'clear-icon', iconSize: [24,24] });
        L.marker([startLat, startLon], { icon: startIcon }).addTo(currentRouteLayer).bindPopup(`<b>Start: ${startQ}</b>`);
        L.marker([endLat, endLon], { icon: endIcon }).addTo(currentRouteLayer).bindPopup(`<b>End: ${endQ}</b>`);

        map.fitBounds(currentRouteLayer.getBounds(), { padding: [50, 50] });

        // Generate synthetic risk anomalies along the route for the wow factor
        simulateRouteRisk(coords);

        // --- NEW: Sync Route with Dashboard Prediction ---
        // Switch location to Urban/Highway based on distance
        $('location').value = routeData.routes[0].distance > 20000 ? 'Highway' : 'Urban';
        $('speed').value = routeData.routes[0].distance > 20000 ? 80 : 40;
        $('speedVal').textContent = $('speed').value;
        
        // Auto-trigger the Prediction Form so dashboard updates with Route Risk
        $('predict-btn').click(); 

        showToast('✅ Route successfully generated! Analyzing Route Risk...', 'success');
    } catch (e) {
        showToast(`❌ Error: ${e.message}`, 'error');
    } finally {
        $('calc-route-btn').textContent = 'Smart Route Path';
    }
}

function simulateRouteRisk(coords) {
    // Pick 2 random points along the route to simulate heavy traffic or accidents
    for(let i=0; i<2; i++) {
        const randIdx = Math.floor(Math.random() * (coords.length * 0.8)) + Math.floor(coords.length * 0.1);
        if(!coords[randIdx]) continue;
        const color = i === 0 ? '#ef4444' : '#f59e0b';
        const msg = i === 0 ? 'High Risk / Severe Traffic Zone' : 'Moderate Traffic Warning';
        L.circleMarker(coords[randIdx], {
            radius: i === 0 ? 300 : 150,
            color: color, fillColor: color, fillOpacity: 0.3, weight: 2
        }).addTo(currentRouteLayer).bindPopup(`<b>${msg}</b><br><small>Route active monitoring</small>`);
        
        L.circleMarker(coords[randIdx], {
            radius: 8, color: color, fillColor: color, fillOpacity: 1, weight: 2
        }).addTo(currentRouteLayer);
    }
}

// ------- Prediction -------
function updateRiskCircle(pct) {
    const circle = $('risk-progress');
    const circumference = 2 * Math.PI * 60; // r=60
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;

    const col = pct < 35 ? '#22c55e' : pct < 65 ? '#f59e0b' : '#ef4444';
    circle.style.stroke = col;
    $('risk-percentage').textContent = `${Math.round(pct)}%`;
    $('risk-percentage').style.color = col;

    const tag = $('risk-level-tag');
    if (pct < 35)      { tag.textContent = '✅ SAFE CONDITION';  tag.style.color = '#22c55e'; }
    else if (pct < 65) { tag.textContent = '⚠️ ELEVATED RISK';  tag.style.color = '#f59e0b'; }
    else               { tag.textContent = '🔴 CRITICAL RISK';  tag.style.color = '#ef4444'; }

    $('risk-bar-fill').style.width = pct + '%';
}

function updateSeverity(sev, trend) {
    const ring = $('sev-ring');
    const label = $('severity-label');
    const desc  = $('severity-desc');
    const emoji = $('severity-emoji');

    ring.className = 'sev-ring ' + sev.toLowerCase();
    label.textContent = sev.toUpperCase();
    label.style.color = { Low:'#22c55e', Medium:'#f59e0b', High:'#ef4444' }[sev];

    const emojis = { Low:'🟢', Medium:'🟡', High:'🔴' };
    emoji.textContent = emojis[sev] || '⏳';

    const descs = {
        Low: 'Minor material damage expected. Low impact on traffic flow.',
        Medium: 'Moderate damage. Possible minor injuries and lane disruptions.',
        High: 'Severe impact. Potential critical injuries and full road blockage.'
    };
    desc.textContent = descs[sev];

    // Breakdown bars (simulated from trend variance)
    const vals = trend ? trend : [0,0,0,0,0,0];
    const avgSev = vals.reduce((a,b) => a+b, 0) / vals.length;
    const normalised = { Low: Math.round((1 - avgSev/2) * 100), Medium: Math.round(Math.min(avgSev/2, 0.5) * 100), High: Math.round((avgSev/2) * 100) };
    $('sev-low').querySelector('div').style.width  = Math.min(100, normalised.Low)  + '%';
    $('sev-med').querySelector('div').style.width  = Math.min(100, normalised.Medium) + '%';
    $('sev-high').querySelector('div').style.width = Math.min(100, normalised.High) + '%';
}

function updateStats(risk, sev) {
    sessionStats.count++;
    sessionStats.riskSum += risk;
    if (risk > 65) sessionStats.highRisk++;
    sessionStats.lastSev = sev;

    $('stat-predictions').textContent = sessionStats.count;
    $('stat-avg-risk').textContent = Math.round(sessionStats.riskSum / sessionStats.count) + '%';
    $('stat-high-risk').textContent = sessionStats.highRisk;
    $('stat-last-sev').textContent = sev;
    $('stat-last-sev').style.color = { Low:'#22c55e', Medium:'#f59e0b', High:'#ef4444' }[sev] || 'inherit';
}

function addToHistory(params, risk, sev) {
    const entry = { ts: Date.now(), ...params, risk: Math.round(risk), sev };
    predHistory.unshift(entry);
    if (predHistory.length > 50) predHistory.pop();
    localStorage.setItem('rs_history', JSON.stringify(predHistory));
    $('history-count').textContent = predHistory.length;
    renderHistory();
}

function renderHistory() {
    const tbody = $('history-body');
    if (!predHistory.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No predictions yet.</td></tr>';
        return;
    }
    const riskClass = r => r < 35 ? 'safe' : r < 65 ? 'elevated' : 'critical';
    tbody.innerHTML = predHistory.map((e, i) => `
        <tr>
            <td style="color:var(--muted)">${i+1}</td>
            <td style="color:var(--muted)">${formatTime(e.ts)}</td>
            <td><b>${e.speed}</b> km/h</td>
            <td>${e.weather}</td>
            <td>${e.location}</td>
            <td>${e.traffic_density}</td>
            <td><span class="risk-chip ${riskClass(e.risk)}">${e.risk}%</span></td>
            <td><span class="sev-chip ${e.sev}">${e.sev}</span></td>
        </tr>`).join('');
}

// ------- Predict Form -------
function initForm() {
    $('prediction-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn     = $('predict-btn');
        const btnText = $('btn-text');
        const spinner = $('loading-spinner');

        btnText.textContent = 'Analyzing…';
        spinner.classList.remove('hidden');
        btn.disabled = true;

        const params = {
            speed:           $('speed').value,
            weather:         $('weather').value,
            road_condition:  $('road_condition').value,
            time:            $('time').value,
            location:        $('location').value,
            traffic_density: getTrafficVal()
        };

        try {
            const res  = await fetch(`${API_BASE}/predict`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(params) });
            const data = await res.json();

            if (data.status === 'success') {
                const pct = data.risk_probability * 100;
                updateRiskCircle(pct);
                updateSeverity(data.severity, data.severity_trend);

                // Update feature importance chart
                importanceChart.data.datasets[0].data = data.feature_importance;
                importanceChart.update('active');

                // Update trend chart
                trendChart.data.datasets[0].data = data.severity_trend;
                trendChart.update('active');

                updateStats(pct, data.severity);
                addToHistory(params, pct, data.severity);

                // AI Summary
                const feats = ['Speed', 'Time', 'Weather', 'Road', 'Location', 'Traffic'];
                let maxIdx = data.feature_importance.indexOf(Math.max(...data.feature_importance));
                let topFeat = feats[maxIdx];
                let summaryTxt = `According to our Random Forest model, ${topFeat} is the primary risk driver for this scenario. The Neural Network predicts a ${data.severity} severity class.`;
                $('ai-summary').style.display = 'block';
                $('ai-summary-text').innerHTML = `According to our Random Forest model, <strong>${topFeat}</strong> is the primary risk driver for this scenario. The Neural Network predicts a <strong>${data.severity}</strong> severity class.`;

                // Voice Playback if Enabled
                if (voiceEnabled && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    let utterance = new SpeechSynthesisUtterance(summaryTxt);
                    if (data.severity === 'High' || pct > 65) {
                        utterance.pitch = 1.2;
                        utterance.rate = 1.0;
                    }
                    window.speechSynthesis.speak(utterance);
                }

                // Pin a temporary marker on map if map is open
                if (map) {
                    const loc = { Urban:[13.056,80.222], Rural:[13.020,80.195], Highway:[13.080,80.270] }[params.location] || [13.056,80.222];
                    const col = pct > 65 ? '#ef4444' : pct > 35 ? '#f59e0b' : '#22c55e';
                    L.circleMarker(loc, { radius:10, color:col, fillColor:col, fillOpacity:0.9, weight:3 })
                        .addTo(map)
                        .bindPopup(`<b>Latest Prediction</b><br/>Risk: <b style="color:${col}">${Math.round(pct)}%</b><br/>Severity: <b>${data.severity}</b>`)
                        .openPopup();
                }

                showToast(`✅ Prediction complete — ${data.severity} severity`, 'success');
            } else {
                showToast('❌ ' + (data.message || 'Prediction failed'), 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('❌ Cannot reach backend. Is the Flask server running?', 'error');
        } finally {
            btnText.textContent = '🔬 Analyze Risk';
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    });
}

// ------- Export -------
function initUtilities() {
    $('export-btn').addEventListener('click', () => {
        if (!predHistory.length) { showToast('No data to export yet.', 'error'); return; }
        const header = 'Time,Speed,Weather,Road,Location,Traffic,Risk%,Severity\n';
        const rows   = predHistory.map(e => `${formatTime(e.ts)},${e.speed},${e.weather},${e.road_condition},${e.location},${e.traffic_density},${e.risk},${e.sev}`).join('\n');
        const blob   = new Blob([header + rows], { type: 'text/csv' });
        const a      = document.createElement('a');
        a.href       = URL.createObjectURL(blob);
        a.download   = `roadsafe_predictions_${Date.now()}.csv`;
        a.click();
        showToast('📤 Exported CSV file!', 'success');
    });

    // Voice Toggle
    $('voice-toggle').addEventListener('click', (e) => {
        voiceEnabled = !voiceEnabled;
        e.target.innerHTML = voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
        e.target.style.background = voiceEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(79,70,229,0.1)';
        e.target.style.borderColor = voiceEnabled ? '#10b981' : 'var(--primary)';
        if(voiceEnabled) showToast('AI Voice Assistant Enabled', 'info');
    });

    // Auto-detect Live Simulation
    $('auto-detect-btn').addEventListener('click', () => {
        const d = new Date();
        const hr = d.getHours();
        $('time').value = hr;
        
        // Simulating Live Context based on Time
        let weather = 'Sunny';
        let traffic = 'Medium';
        let road = 'Dry';

        if(hr >= 18 || hr <= 6) { traffic = (hr>=18 && hr<=21) ? 'High' : 'Low'; road = 'Wet'; weather = 'Foggy'; }
        if(hr >= 8 && hr <= 10) traffic = 'High';

        $('weather').value = weather;
        $('road_condition').value = road;
        $('location').value = 'Urban';
        document.getElementById(traffic === 'Low' ? 't-low' : traffic === 'Medium' ? 't-med' : 't-high').checked = true;

        showToast('📍 Auto-synced real-time computer clock local conditions!', 'success');
        
        // Quick visual ping
        $('auto-detect-btn').style.transform = 'scale(1.1)';
        setTimeout(()=> $('auto-detect-btn').style.transform = 'scale(1)', 300);
    });
    
    // Route Calculation Bind
    $('calc-route-btn').addEventListener('click', findSmartRoute);
    $('route-end').addEventListener('keypress', e => { if (e.key === 'Enter') findSmartRoute(); });

    $('reset-btn').addEventListener('click', () => {
        $('speed').value = 60;
        $('speedVal').textContent = 60;
        $('weather').value = 'Sunny';
        $('road_condition').value = 'Dry';
        $('time').value = 12;
        $('location').value = 'Urban';
        document.getElementById('t-low').checked = true;
        showToast('🔄 Form reset', 'info');
    });

    $('clear-history').addEventListener('click', () => {
        predHistory = [];
        localStorage.removeItem('rs_history');
        $('history-count').textContent = 0;
        renderHistory();
        showToast('🗑️ History cleared', 'info');
    });
}

// ------- Metrics -------
async function fetchMetrics() {
    try {
        const res = await fetch(`${API_BASE}/metrics`);
        const data = await res.json();
        if(data.status === 'success') {
            const m = data.metrics;
            const render = (obj) => `
                <div class="metric-box"><div class="metric-val">${(obj.accuracy*100).toFixed(1)}%</div><div class="metric-name">Accuracy</div></div>
                <div class="metric-box"><div class="metric-val">${(obj.precision*100).toFixed(1)}%</div><div class="metric-name">Precision</div></div>
                <div class="metric-box"><div class="metric-val">${(obj.recall*100).toFixed(1)}%</div><div class="metric-name">Recall</div></div>
                <div class="metric-box"><div class="metric-val">${(obj.f1*100).toFixed(1)}%</div><div class="metric-name">F1-Score</div></div>
            `;
            $('rf-metrics').innerHTML = render(m.rf);
            $('mlp-metrics').innerHTML = render(m.mlp);
        }
    } catch (e) { console.log("Failed to load metrics"); }
}

// ------- Bootstrap -------
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initCharts();
    initForm();
    initUtilities();
    setupSearch();
    fetchMetrics();
    renderHistory();
    $('history-count').textContent = predHistory.length;

    // Server check
    $('connection-status').className = 'status-badge checking';
    $('connection-status').textContent = '● Checking…';
    setTimeout(checkServer, 800);

    // Initial ring animation
    updateRiskCircle(0);

    // Particles JS tech aesthetic
    if (window.particlesJS) {
        particlesJS('particles-js', {
            particles: {
                number: { value: 60, density: { enable: true, value_area: 800 } },
                color: { value: "#3b82f6" },
                shape: { type: "circle" },
                opacity: { value: 0.3, random: false },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: "#3b82f6", opacity: 0.2, width: 1 },
                move: { enable: true, speed: 2, direction: "none", random: false, straight: false, out_mode: "out", bounce: false }
            },
            interactivity: {
                detect_on: "canvas",
                events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: true, mode: "push" }, resize: true },
                modes: { grab: { distance: 140, line_linked: { opacity: 0.8 } }, push: { particles_nb: 4 } }
            },
            retina_detect: true
        });
    }
});
