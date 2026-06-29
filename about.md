# Landsail Automation System Manual

Welcome to the Landsail Pro Dashboard! This dashboard is calibrated for a standard beach landsailing configuration (5.2m² sail, 80kg rider payload on tidal flats). It helps you quickly identify safe, windy, and hard-packed sand windows.

---

## 🟢 Quick Start Guide (For Riders)

### 1. How to Read the 7-Wedge "Cheese" Map Icons
Each marker on the map is a **7-wedge cheese wheel** showing the forecast outlook for the next 7 days (numbered 1 to 7, starting from Today). The wedges are color-coded based on wind conditions:

* **🟥 RED (0 - 17 km/h): Insufficient Wind.** Too light to break static rolling resistance on sand. You will stall out and get stuck in soft sand.
* **🟨 YELLOW (18 - 25 km/h): Safe & Cruising.** Ideal cruising zone. The sail builds enough power to stay on top of the hard sand crust cleanly without capsizing risks.
* **🟩 GREEN (26 - 38 km/h): Peak Performance.** Sail fully pressurized. Apparent wind values multiply acceleration. High speeds across tidal flats.
* **🟪 PURPLE (39+ km/h): Expert Only.** High risk of sudden capsizing. Massive lateral lift forces will cause the cart to two-wheel. Advanced reflexes required.

### 2. How to Read the Low Tide Table
Clicking any beach icon on the map displays a 7-day low tide outlook schedule. Since beach sailing requires hard sand, the table displays a **5-hour window** around each low tide apex (from 2 hours before to 2 hours after).
* **Look for Green or Yellow wind speeds** alongside a **high tide coefficient (80%+)** for the largest, fastest, and safest dry sand runway.

### 3. Get Phone Notifications (ntfy.sh)
You can receive instant push notifications on your phone 2 to 7 days before a great riding window occurs:
1. Download the free **ntfy** app on your mobile phone ([iOS App Store](https://apps.apple.com/us/app/ntfy/id1625396347) / [Google Play Store](https://play.google.com/store/apps/details?id=io.heckel.ntfy)).
2. Click the **🔔 icon** next to your favorite beaches in the sidebar list layout on this dashboard to subscribe to their broadcast channels inside the app.

---

## 🤓 Geek & Developer Details

<details>
<summary><b>🛠️ Engine Operations & Cron Pipeline</b> (Click to expand)</summary>

The system runs entirely serverless and updates automatically once a day:
1. **GitHub Actions Workflow:** Runs once a day automatically (every morning at 7:00 AM UTC / 8:00 AM West European Summer Time) using the configuration specified in `.github/workflows/daily-check.yml`.
2. **Grid Scanning:** The backend script (`cron-check.js`) reads coordinates from the [spots.json](./spots.json) file and fetches the Open-Meteo Marine API and Weather Forecasting API.
3. **Condition Filtering & Alerts:** If upcoming conditions match or exceed target thresholds (wind speed > 18 km/h and tide coefficient > 80%) between 2 to 7 days ahead, it sends a payload directly to the respective `ntfy.sh` topic.

</details>

<details>
<summary><b>🌊 Low Tide Analysis & Mathematical Coefficients</b> (Click to expand)</summary>

To guarantee geographical precision across unique Atlantic coastlines, the engine compiles a 31-day rolling historical tracking array for each spot to isolate baseline spring/neap range extremes. It then scores current upcoming entries on a standard 0 to 120 scale using this calculation:

* **Tide Coefficient** = `((High Tide Height - Low Tide Height) / Maximum Historical Difference) × 120`

The dashboard displays a converted percentage scale next to the coefficient:

* **Percentage of Max Spring** = `(Tide Coefficient / 120) × 100`

This serves as a direct rating of exposed beach width:
* **80% to 100% (Premium Spring Tide):** Water pulls back to extreme limits, leaving a massive, hard-packed sand flat.
* **50% to 79% (Mean/Average Tide):** Standard drop. Good riding space, but soft dry sand traps sit closer to your run.
* **Below 50% (Neap Tide):** Weak water movement. The beach remains highly restricted, narrow, and saturated with wet sand.

</details>

<details>
<summary><b>📍 Adding a New Beach Location</b> (Click to expand)</summary>

To track a new beach, simply edit the [spots.json](./spots.json) file inside the repository and append a new structured object node:

```json
{
  "name": "Peniche / Baleal",
  "lat": 39.3734,
  "lon": -9.3361,
  "tideforescast": "Peniche",
  "ntfyTopic": "landsail_peniche_2026"
}
```

</details>