const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WIND_THRESHOLD = 20;//10; 
const COEFF_THRESHOLD = 80;//80;

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

                        const message = `🚨 Perfect Landsail Window Spotted!\n📅 Time: ${displayTime}h\n💨 Wind: ${windAtT.toFixed(1)} km/h\n🌊 Tide Coeff: ${coeff}`;
                        await sendNotification(spot.ntfyTopic, spot.name, message);
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (err) {
        console.error("Critical Runtime Error during processing loop:", err.message);
    }
}

async function sendNotification(topic, beachName, message) {
    await axios.post(`https://ntfy.sh/${topic}`, message, {
        headers: {
            'Title': `⛵ Landsail Spotting: ${beachName}`,
            'Priority': 'high',
            'Tags': 'wind_face,ocean'
        }
    });
    console.log(`Notification sent out to topic: ${topic}`);
}

checkAllSpots();