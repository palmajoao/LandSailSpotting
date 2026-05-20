const map = L.map('map').setView([38.7223, -9.1393], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

async function initDashboard() {
    try {
        const spotsResponse = await fetch('./spots.json');
        const spots = await spotsResponse.json();

        for (const spot of spots) {
            const data = await fetchSpotData(spot);
            renderSpot(spot, data);
        }
    } catch (err) {
        console.error("Initialization Error:", err);
    } finally {
        document.getElementById('loader')?.remove();
    }
}

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
                isGood: windAtT >= 10, 
                coeff: Math.round(((Math.max(...tide.sea_level_height_msl.slice(i-6, i+6)) - tide.sea_level_height_msl[i]) / refAmp) * 120)
            });
        }
    }
    return windows;
}

// Helper to determine color based on wind speed
function getColorForWind(windSpeed) {
    if (windSpeed >= 20) return "#198754"; // Green
    if (windSpeed >= 10) return "#ffc107"; // Yellow
    return "#dc3545"; // Red
}

function renderSpot(spot, windows) {
    const listContainer = document.getElementById('spot-list');
    const spotKey = spot.name.replace(/\s+/g, '');
    const golden = windows.find(w => w.isGood) || windows[0];
    const coeffPct = Math.round((golden.coeff / 120) * 100);

    // --- 1. RENDER SIDEBAR CARD ---
    const card = document.createElement('div');
    card.className = `list-group-item mb-2 shadow-sm border-start border-4 ${golden.isGood ? 'border-success' : 'border-light'}`;
    
    card.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-1">
        <h6 class="fw-bold mb-0 small text-uppercase">${spot.name}</h6>
        <div class="d-flex gap-2 align-items-center">
            <a href="https://ntfy.sh/${spot.ntfyTopic}" target="_blank" class="alert-toggle" title="Subscribe to push notifications">🔔</a>
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

    document.getElementById(`fly-${spotKey}`).addEventListener('click', () => {
        map.flyTo([spot.lat, spot.lon], 12);
    });

    // --- 2. GENERATE 4-WAY CHEESE PIE COLORS ---
    const today = new Date();
    const dayColors = ["#dc3545", "#dc3545", "#dc3545", "#dc3545"]; // Default all to Red

    [0, 1, 2, 3].forEach(idx => {
        const target = new Date(); 
        target.setDate(today.getDate() + idx);
        const d = windows.find(w => w.time.toDateString() === target.toDateString());
        if (d) {
            dayColors[idx] = getColorForWind(d.winds[1]);
        }
    });

    // Custom HTML/SVG Icon replicating a 4-part cheese wedge layout with day numbers
    const cheeseIcon = L.divIcon({
        className: 'custom-cheese-icon',
        html: `
            <svg width="46" height="46" viewBox="0 0 46 46" style="background: white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1px solid #666;">
                <path d="M 23,23 L 23,2 A 21,21 0 0,1 44,23 Z" fill="${dayColors[0]}" />
                <text x="31" y="16" font-size="10" font-weight="bold" fill="${dayColors[0] === '#ffc107' ? '#000' : '#fff'}">1</text>
                
                <path d="M 23,23 L 44,23 A 21,21 0 0,1 23,44 Z" fill="${dayColors[1]}" />
                <text x="31" y="34" font-size="10" font-weight="bold" fill="${dayColors[1] === '#ffc107' ? '#000' : '#fff'}">2</text>
                
                <path d="M 23,23 L 23,44 A 21,21 0 0,1 2,23 Z" fill="${dayColors[2]}" />
                <text x="13" y="34" font-size="10" font-weight="bold" fill="${dayColors[2] === '#ffc107' ? '#000' : '#fff'}">3</text>
                
                <path d="M 23,23 L 2,23 A 21,21 0 0,1 23,2 Z" fill="${dayColors[3]}" />
                <text x="13" y="16" font-size="10" font-weight="bold" fill="${dayColors[3] === '#ffc107' ? '#000' : '#fff'}">4</text>
                
                <line x1="23" y1="2" x2="23" y2="44" stroke="#444" stroke-width="1" />
                <line x1="2" y1="23" x2="44" y2="23" stroke="#444" stroke-width="1" />
            </svg>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
    });

    // --- 3. BUILD POPUP WITH TABLE AND LINKS ---
    const m = L.marker([spot.lat, spot.lon], { icon: cheeseIcon }).addTo(map);

    // Helper function to get the English ordinal suffix for a day number
    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1:  return "st";
            case 2:  return "nd";
            case 3:  return "rd";
            default: return "th";
        }
    };

    let rows = windows.slice(0, 7).map(w => {
        const isNight = w.time.getHours() < 7 || w.time.getHours() >= 20;
        const rClass = w.winds[1] >= 20 ? "table-success" : (w.winds[1] >= 10 ? "table-warning" : "table-danger");
        
        // Construct the custom prefix (e.g., "21st May, Thu 13h")
        const dayNum = w.time.getDate();
        const suffix = getOrdinalSuffix(dayNum);
        const monthShort = w.time.toLocaleDateString([], { month: 'short' });
        const weekdayShort = w.time.toLocaleDateString([], { weekday: 'short' });
        const hourStr = w.time.getHours().toString().padStart(2, '0');

        const dateDisplayStr = `${dayNum}${suffix} ${monthShort}, ${weekdayShort} ${hourStr}h`;

        return `<tr class="${rClass}">
            <td class="small px-1 text-nowrap">${isNight ? '🌙' : '☀️'} ${dateDisplayStr}</td>
            <td class="small text-center">${w.winds[0].toFixed(0)}</td>
            <td class="small text-center fw-bold bg-white bg-opacity-25">${w.winds[1].toFixed(0)}</td>
            <td class="small text-center">${w.winds[2].toFixed(0)}</td>
            <td class="small text-nowrap text-center">${w.coeff} (${Math.round(w.coeff/1.2)}%)</td>
        </tr>`;
    }).join('');

    m.bindPopup(`
        <div style="min-width:350px">
            <h6 class="fw-bold border-bottom pb-1 mb-2">${spot.name} <span class="float-end small text-muted">4-Day Outlook</span></h6>
            <table class="table table-sm table-bordered mb-2" style="font-size:0.65rem">
                <thead class="table-light">
                    <tr>
                        <th rowspan="2" class="align-middle text-center">Day/Hr</th>
                        <th colspan="3" class="text-center bg-secondary bg-opacity-10">Windspeeds (km/h)</th>
                        <th rowspan="2" class="align-middle text-center">Coeff</th>
                    </tr>
                    <tr>
                        <th class="text-center small text-muted">Low-2h</th>
                        <th class="text-center fw-bold">Low Tide</th>
                        <th class="text-center small text-muted">Low+2h</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            
            <div class="d-flex gap-2 mt-2">
                <a href="https://www.tide-forecast.com/locations/${spot.tideforescast}/tides/latest" target="_blank" class="btn btn-sm btn-outline-primary w-50 py-1 fw-bold" style="font-size:0.65rem;">
                   🌊 TIDE FORECAST
                </a>
                <a href="https://www.windy.com/v/forecast/${spot.lat}/${spot.lon}" target="_blank" class="btn btn-sm btn-info text-white w-50 py-1 fw-bold" style="font-size:0.65rem; background-color: #32557b; border-color: #294666;">
                   💨 OPEN WINDY
                </a>
            </div>
        </div>`, { minWidth: 360 });
}

initDashboard();