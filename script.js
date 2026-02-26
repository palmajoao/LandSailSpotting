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
            await checkAndNotify(spot, data);
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

async function sendTestNotification() {
    console.log("Test button clicked. Permission is:", Notification.permission);

    if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            alert("Permission denied. Click the Lock (🔒) icon in the URL bar to reset.");
            return;
        }
    }

    // Use the Service Worker to show the notification (The "App" way)
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification("🌬️ LandSail Alert", {
            body: "The notification system is working!",
            icon: "./favicon.ico", // Ensure this exists in your repo
            badge: "./favicon.ico",
            vibrate: [200, 100, 200],
            tag: "test-alert"
        });
    } else {
        // Fallback for standard web
        new Notification("🌬️ LandSail Alert", { body: "Working!" });
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
    // Calculate the percentage relative to 120
    const coeffPct = Math.round((golden.coeff / 120) * 100);

    // --- 1. SIDEBAR CARD RENDERING ---
    const card = document.createElement('div');
    card.className = `list-group-item mb-2 shadow-sm border-start border-4 ${golden.isGood ? 'border-success' : 'border-light'} ${spot.alertEnabled ? 'bg-white border-primary' : ''}`;
    card.style.cursor = "default";
    
    card.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-1">
        <h6 class="fw-bold mb-0 small text-uppercase">${spot.name}</h6>
        <div class="d-flex gap-2">
            <span class="alert-toggle" style="cursor:pointer" id="bell-${spotKey}">${spot.alertEnabled ? '🔔' : '🔕'}</span>
            <span class="badge ${golden.isGood ? 'bg-success' : 'bg-secondary'}">${golden.isGood ? 'GOLDEN' : 'STANDBY'}</span>
        </div>
    </div>
    <div class="row align-items-center" style="cursor:pointer" id="fly-${spotKey}">
        <div class="col-6">
            <div class="h4 mb-0 fw-bold">${golden.winds[1].toFixed(1)} <small class="h6 text-muted">km/h</small></div>
        </div>
        <div class="col-6 text-end small">
            <b>${golden.time.getHours()}:00</b>h | Coeff: ${golden.coeff} <b>(${coeffPct}%)</b>
        </div>
    </div>
`;
    
    listContainer.appendChild(card);

    // --- 2. SIDEBAR EVENT LISTENERS ---
    document.getElementById(`bell-${spotKey}`).addEventListener('click', (e) => {
        spot.alertEnabled = !spot.alertEnabled;
        localStorage.setItem(`alert-${spotKey}`, spot.alertEnabled);
        e.target.innerText = spot.alertEnabled ? '🔔' : '🔕';
        card.classList.toggle('border-primary', spot.alertEnabled);
    });

    document.getElementById(`fly-${spotKey}`).addEventListener('click', () => {
        map.flyTo([spot.lat, spot.lon], 12);
    });

    // --- 3. MAP TIMELINE (TODAY, TOMORROW, DAY 2) ---
    const drawTimeline = () => {
        const multiplier = 0.5 / Math.pow(2, map.getZoom() - 7);
        const today = new Date();

        [0, 1, 2].forEach(idx => {
            const target = new Date(); 
            target.setDate(today.getDate() + idx);
            const activeDateString = target.toDateString();
            const d = windows.find(w => w.time.toDateString() === activeDateString);

            if (d) {
                const color = d.winds[1] >= 20 ? "#198754" : (d.winds[1] >= 15 ? "#ffc107" : "#dc3545");
                const m = L.circleMarker([spot.lat, spot.lon + (idx * multiplier)], {
                    radius: idx === 0 ? 12 : 8, 
                    fillColor: color, 
                    color: "#fff", 
                    weight: 2, 
                    fillOpacity: 0.9, 
                    className: `timeline-${spotKey}`
                }).addTo(map);

                // --- 4. POPUP TABLE WITH SUN/MOON & HIGHLIGHT ---
                let rows = windows.slice(0, 7).map(w => {
                    const isSelectedDay = w.time.toDateString() === activeDateString;
                    const isNight = w.time.getHours() < 7 || w.time.getHours() >= 20;
                    const rClass = w.winds[1] >= 20 ? "table-success" : (w.winds[1] >= 15 ? "table-warning" : "table-danger");
                    
                    // The "Bold Black Box" for the clicked day
                    const highlightStyle = isSelectedDay ? 'outline: 1px solid black; outline-offset: -3px; font-weight: bold; font-size:1.3em' : '';

                    return `<tr class="${rClass}" style="${highlightStyle}">
                        <td class="small px-1 text-nowrap">${isNight ? '🌙' : '☀️'} ${w.time.toLocaleDateString([], {weekday:'short', hour:'2-digit'})}h</td>
                        <td class="small text-center">${w.winds[0].toFixed(0)}</td>
                        <td class="small text-center fw-bold bg-white bg-opacity-25">${w.winds[1].toFixed(0)}</td>
                        <td class="small text-center">${w.winds[2].toFixed(0)}</td>
                        <td class="small text-nowrap text-center">${w.coeff} (${Math.round(w.coeff/1.2)}%)</td>
                    </tr>`;
                }).join('');

                m.bindPopup(`
                    <div style="min-width:300px">
                        <h6 class="fw-bold border-bottom pb-1">${spot.name} <small class="text-muted">(${idx === 0 ? 'Today' : (idx === 1 ? 'Tomorrow' : 'Day 2')})</small></h6>
                        <table class="table table-sm table-bordered mb-2" style="font-size:0.65rem">
                            <thead class="table-light">
                                <tr><th>Day/Hr</th><th>T-2</th><th>Low</th><th>T+2</th><th>Coeff</th></tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                        <a href="https://www.tide-forecast.com/locations/${spot.tideforescast}/tides/latest" 
                           target="_blank" 
                           class="btn btn-sm btn-outline-primary w-100 py-1" 
                           style="font-size:0.7rem; font-weight:700;">
                           <img src="./favicon.ico" width="14" onerror="this.src='https://www.tide-forecast.com/favicon.ico'"> OPEN TIDE FORECAST
                        </a>
                    </div>`, { minWidth: 320 });
            }
        });
    };

    drawTimeline();
    
    // Refresh markers on zoom
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

async function checkAndNotify(spot, windows) {
    if (spot.alertEnabled && Notification.permission === "granted") {
        const g = windows.find(w => w.isGood);
        if (g) {
            // Try Service Worker first (Better for PWA)
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(`🚀 Golden Window: ${spot.name}`, {
                    body: `${g.time.getHours()}h | Wind: ${g.winds[1].toFixed(1)} km/h`,
                    icon: "./favicon.ico",
                    badge: "./favicon.ico",
                    tag: `alert-${spot.name}`, // Prevents duplicate alerts for the same spot
                    vibrate: [200, 100, 200]
                });
            } else {
                // Classic fallback
                new Notification(`🚀 Golden Window: ${spot.name}`, {
                    body: `${g.time.getHours()}h | Wind: ${g.winds[1].toFixed(1)} km/h`,
                    icon: "https://www.tide-forecast.com/favicon.ico"
                });
            }
        }
    }
}

// Kickstart
initDashboard();