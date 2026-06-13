const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WIND_THRESHOLD = 18; 
const COEFF_THRESHOLD = 80;

async function checkAllSpots() {
    try {
        // Read spots.json file directly from the root path directory
        const jsonPath = path.join(__dirname, 'spots.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        const spots = JSON.parse(fileContent);

        for (const spot of spots) {
            console.log(`Running background scan for: ${spot.name}...`);
            
            const tideUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lon}&hourly=sea_level_height_msl&past_days=31&forecast_days=7`;
            const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}&hourly=wind_speed_10m&past_days=31&forecast_days=7`;
            
            const [resT, resW] = await Promise.all([axios.get(tideUrl), axios.get(windUrl)]);
            const tHourly = resT.data.hourly;
            const wHourly = resW.data.hourly;
            
            const historyIdx = 31 * 24;
            const historyHeights = tHourly.sea_level_height_msl.slice(0, historyIdx);
            const refAmp = Math.max(...historyHeights) - Math.min(...historyHeights);

            // Container to collect all ideal windows for this specific spot
            let matchingWindows = [];

            // Filter strictly for 2 to 4 days ahead (48 hours to 96 hours out)
            for (let i = historyIdx + 48; i < historyIdx + 96; i++) {
                if (i >= tHourly.sea_level_height_msl.length - 3) break;
                
                const range = tHourly.sea_level_height_msl.slice(i - 6, i + 7);
                if (tHourly.sea_level_height_msl[i] === Math.min(...range)) {
                    const windAtT = wHourly.wind_speed_10m[i];
                    const localMax = Math.max(...tHourly.sea_level_height_msl.slice(i - 6, i + 6));
                    const coeff = Math.round(((localMax - tHourly.sea_level_height_msl[i]) / refAmp) * 120);

                    if (windAtT >= WIND_THRESHOLD && coeff >= COEFF_THRESHOLD) {
                        const rawTime = new Date(tHourly.time[i]);
                        const displayTime = rawTime.toLocaleString('pt-PT', { 
                            timeZone: 'Europe/Lisbon',
                            weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                        });
                        
                       const lowTideHour = rawTime.toLocaleTimeString('pt-PT', { 
                            timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' 
                        });

                        // Store a neat single-line summary string for this session window
                        matchingWindows.push(
                            `📅 ${displayTime}h\n` + 
                            `📉 Low Tide: ${lowTideHour}h\n` +
                            `💨 Wind: ${windAtT.toFixed(1)} km/h ` +
                            `| 🌊 Coeff: ${coeff}`);
                    }
                }
            }

            // After scanning all windows for this beach, fire exactly ONE notification summary
            if (matchingWindows.length > 0) {
                // Join separate sessions cleanly with clear space breaks
                const consolidatedMessage = `The following upcoming riding sessions have matched your beach riding criteria:\n\n` + matchingWindows.join('\n\n');
                
                await sendNotification(spot.ntfyTopic, spot.name, consolidatedMessage);
            } else {
                console.log(`Scan complete for ${spot.name}: No matching conditions found in this 48h-96h cycle.`);
            }

            // Avoid rate limits between distinct spot queries
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (err) {
        console.error("Critical Runtime Error during processing loop:", err.message);
    }
}

async function sendNotification(topic, beachName, message) {
    try {
        await axios.post(`https://ntfy.sh/${topic}`, message, {
            headers: {
                'Title': `⛵ Daily Landsail Update: ${beachName}`,
                'Priority': 'high',
                'Tags': 'wind_face,ocean',
                'Actions': 'view, Open Live Dashboard, https://palmajoao.github.io/LandSailSpotting/'
            }
        });
        console.log(`Consolidated notification summary safely sent out to topic: ${topic}`);
    } catch (postErr) {
        console.error(`Failed pushing data out to ntfy server channel: ${postErr.message}`);
    }
}

checkAllSpots();
