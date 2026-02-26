const SPOTS = [
    { name: "Vila Real de S. António", lat: 37.1594, lon: -7.4071, tideforescast:"Vila-Real-de-Santo-Antonio-Portugal" },
    { name: "Peniche / Baleal", lat: 39.3741, lon: -9.3355, tideforescast:"Peniche-Portugal" }
];

const map = L.map('map').setView([38.7223, -9.1393], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// --- 1. CORE FUNCTIONS ---

async function initDashboard() {
    setupAlertButtons(); // Initialize button listeners
    updateAlertUI();
    
    const listContainer = document.getElementById('spot-list');
    try {
        for (const spot of SPOTS) {
            const spotKey = spot.name.replace(/\s+/g, '');
            spot.alertEnabled = localStorage.getItem(`alert-${spotKey}`) === 'true';
            
            const data = await fetchSpotData(spot);
            renderSpot(spot, data);
            checkAndNotify(spot, data);
        }
    } catch (err) {
        console.error("Init Error:", err);
    } finally {
        document.getElementById('loader')?.remove();
    }
}

function setupAlertButtons() {
    const btnEnable = document.getElementById('btn-enable-alerts');
    const btnTest = document.getElementById('btn-test-alert');

    if (btnEnable) {
        btnEnable.addEventListener('click', async () => {
            console.log("Button clicked!"); // Check your console (F12) for this
            
            if (location.protocol === 'file:') {
                alert("ERROR: Notifications won't work while opening the file directly. You must use a local server (http://) or upload it to a host.");
                return;
            }

            try {
                const permission = await Notification.requestPermission();
                console.log("Permission status:", permission);
                if (permission === "granted") {
                    sendTestNotification();
                }
                updateAlertUI();
            } catch (e) {
                alert("Notification request failed. Check if you are in Incognito mode.");
            }
        });
    }

    if (btnTest) {
        btnTest.addEventListener('click', () => {
            console.log("Test alert clicked");
            sendTestNotification();
        });
    }
}

function sendTestNotification() {
    if (Notification.permission === "granted") {
        new Notification("🌬️ Alert System Active", {
            body: "Ready to spot Golden Windows! Toggle the bell on your spots.",
            icon: "https://www.tide-forecast.com/favicon.ico"
        });
    } else {
        alert("Please enable notifications first.");
    }
}

// --- 2. DATA FETCHING ---

async function fetchSpotData(spot) {
    const tideUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lon}&hourly=sea_level_height_msl&past_days=31&forecast_days=7`;
    const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}&hourly=wind_speed_10m,wind_direction_10m&past_days=31&forecast_days=7`;
    const [resT, resW] = await Promise.all([fetch(tideUrl), fetch(windUrl)]);
    const tJson = await resT.json();
    const wJson = await resW.json();
    const historyIdx = 31 * 24;
    const refAmp = Math.max(...tJson.hourly.sea_level_height_msl.slice(0, historyIdx)) - Math.min(...tJson.hourly.sea_level_height_msl.slice(0, historyIdx));
    return processTideWindows(tJson.hourly, wJson.hourly, refAmp, historyIdx);
}

function processTideWindows(tide, wind, refAmp, start) {
    const windows = [];
    for (let i = start; i < tide.sea_level_height_msl.length - 3; i++) {
        const range = tide.sea_level_height_msl.slice(i - 6, i + 7);
        if (tide.sea_level_height_msl[i] === Math.min(...range)) {
            const windAtT = wind.wind_speed_10m[i];
            windows.push({
                time: new Date(tide.time[i]),
                winds: [wind.wind_speed_10m[i-2], windAtT, wind.wind_speed_10m[i+2]],
                direction: wind.wind_direction_10m[i],
                isGood: windAtT >= 20,
                coeff: Math.round(((Math.max(...tide.sea_level_height_msl.slice(i-6, i+6)) - tide.sea_level_height_msl[i]) / refAmp) * 120)
            });
        }
    }
    return windows;
}

// --- 3. UI RENDERING ---

function renderSpot(spot, windows) {
    const listContainer = document.getElementById('spot-list');
    const spotKey = spot.name.replace(/\s+/g, '');
    const golden = windows.find(w => w.isGood) || windows[0];

    const card = document.createElement('div');
    card.className = `list-group-item mb-2 shadow-sm border-start border-4 ${golden.isGood ? 'border-success' : 'border-light'} ${spot.alertEnabled ? 'bg-white border-primary' : ''}`;
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-1">
            <h6 class="fw-bold mb-0 small text-uppercase">${spot.name}</h6>
            <div class="d-flex gap-2">
                <span class="alert-toggle" style="cursor:pointer" id="bell-${spotKey}">${spot.alertEnabled ? '🔔' : '🔕'}</span>
                <span class="badge ${golden.isGood ? 'bg-success' : 'bg-secondary'}">${golden.isGood ? 'GOLDEN' : 'STANDBY'}</span>
            </div>
        </div>
        <div class="row align-items-center" style="cursor:pointer" id="fly-${spotKey}">
            <div class="col-6"><div class="h4 mb-0 fw-bold">${golden.winds[1].toFixed(1)} <small class="h6 text-muted">km/h</small></div></div>
            <div class="col-6 text-end small"><b>${golden.time.getHours()}:00</b>h | Coeff: ${golden.coeff}</div>
        </div>
    `;
    listContainer.appendChild(card);

    // Event Listeners attached after append to ensure IDs exist
    document.getElementById(`bell-${spotKey}`).addEventListener('click', (e) => {
        spot.alertEnabled = !spot.alertEnabled;
        localStorage.setItem(`alert-${spotKey}`, spot.alertEnabled);
        e.target.innerText = spot.alertEnabled ? '🔔' : '🔕';
        card.classList.toggle('border-primary', spot.alertEnabled);
    });

    document.getElementById(`fly-${spotKey}`).addEventListener('click', () => map.flyTo([spot.lat, spot.lon], 12));

    const drawTimeline = () => {
        const multiplier = 0.5 / Math.pow(2, map.getZoom() - 7);
        const today = new Date();
        [0,1,2].forEach(idx => {
            const target = new Date(); target.setDate(today.getDate() + idx);
            const d = windows.find(w => w.time.toDateString() === target.toDateString());
            if (d) {
                const color = d.winds[1] >= 20 ? "#198754" : (d.winds[1] >= 15 ? "#ffc107" : "#dc3545");
                const m = L.circleMarker([spot.lat, spot.lon + (idx * multiplier)], {
                    radius: idx === 0 ? 12 : 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9, className: `timeline-${spotKey}`
                }).addTo(map);

                let rows = windows.slice(0, 7).map(w => {
                    const active = w.time.toDateString() === target.toDateString();
                    const rClass = w.winds[1] >= 20 ? "table-success" : (w.winds[1] >= 15 ? "table-warning" : "table-danger");
                    const style = active ? 'outline: 3px solid black; outline-offset: -3px; font-weight: bold;' : '';
                    return `<tr class="${rClass}" style="${style}">
                        <td class="small px-1">${w.time.getHours()}h</td>
                        <td class="small text-center">${w.winds[0].toFixed(0)}</td>
                        <td class="small text-center fw-bold bg-white bg-opacity-25">${w.winds[1].toFixed(0)}</td>
                        <td class="small text-center">${w.winds[2].toFixed(0)}</td>
                        <td class="small text-nowrap text-center">${w.coeff} (${Math.round(w.coeff/1.2)}%)</td>
                    </tr>`;
                }).join('');

                m.bindPopup(`<div style="min-width:300px"><h6 class="fw-bold border-bottom pb-1">${spot.name}</h6>
                    <table class="table table-sm table-bordered mb-2" style="font-size:0.65rem">
                        <thead class="table-light"><tr><th>Hr</th><th>T-2</th><th>Low</th><th>T+2</th><th>Coeff</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <a href="https://www.tide-forecast.com/locations/${spot.tideforescast}/tides/latest" target="_blank" class="btn btn-sm btn-outline-primary w-100 py-1" style="font-size:0.7rem; font-weight:700;">
                        <img src="https://www.tide-forecast.com/favicon.ico" width="14"> OPEN TIDE FORECAST
                    </a></div>`, { minWidth: 320 });
            }
        });
    };
    drawTimeline();
    map.on('zoomend', () => {
        map.eachLayer(l => l.options?.className === `timeline-${spotKey}` && map.removeLayer(l));
        drawTimeline();
    });
}

// --- 4. UTILITIES ---

function updateAlertUI() {
    const badge = document.getElementById('status-badge');
    const setup = document.getElementById('setup-view');
    const active = document.getElementById('active-view');
    if (!badge || !setup || !active) return;

    const isGranted = Notification.permission === "granted";
    badge.innerText = isGranted ? "Active" : "Disabled";
    badge.className = `badge ${isGranted ? "bg-success" : "bg-danger"}`;
    setup.style.display = isGranted ? "none" : "block";
    active.style.display = isGranted ? "block" : "none";
}

function checkAndNotify(spot, windows) {
    if (spot.alertEnabled && Notification.permission === "granted") {
        const g = windows.find(w => w.isGood);
        if (g) {
            new Notification(`🚀 Golden Window: ${spot.name}`, {
                body: `${g.time.getHours()}h | Wind: ${g.winds[1].toFixed(1)} km/h`,
                icon: "https://www.tide-forecast.com/favicon.ico"
            });
        }
    }
}

// Kickstart
initDashboard();