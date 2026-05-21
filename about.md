# Landsail Automation System Manual

An automated meteorological engine and interactive analytical tracking dashboard optimized specifically for beach landsailing setups utilizing a **5.2m² sail** and an **80kg driver payload capacity** on tidal flats.

---

## 🔄 Engine Operations & Cron Pipeline

The system architecture functions entirely serverless and runs automatically without requiring dedicated hosting hardware:

1. **GitHub Actions Worker Execution:** Every 3 hours (8 times a day), a scheduled background cron worker initializes automatically using the schedule config specified in `.github/workflows/daily-check.yml`.
2. **Meteorological Grid Scanning:** The script (`cron-check.js`) reads coordinates directly from `spots.json`, calling the Open-Meteo Marine API and Weather Forecasting API simultaneously.
3. **Condition Filtering & Direct Alerts:** The script filters data to isolate localized low-tide windows. If upcoming conditions match or exceed your performance thresholds, it sends an encrypted notification payload directly to your phone using the **ntfy.sh** delivery framework.

---

## 📊 Low Tide Analysis & Variable Coefficients

Because landsailing on beaches requires maximum clearance from waves and soft dunes, a session window maps out across a strict **5-hour block** centered precisely at the low tide apex ($T-2\text{h}$ to $T+2\text{h}$).

To guarantee geographical precision across unique Atlantic coastlines, the engine dynamically compiles a 31-day rolling historical tracking array for your exact coordinates to isolate absolute baseline spring/neap range extremes. It then scores current upcoming entries on a standard 0 to 120 scale:

$$\text{Local Coeff} = \text{Math.round}\left(\frac{\text{HighTide}_{\text{Max Peak}} - \text{LowTide}_{\text{Current Min}}}{\text{Historical Max Delta}} \times 120\right)$$

### 💡 What does the "% of Max Spring" mean?
Next to the raw coefficient calculation, the dashboard displays a converted percentage scale:
$$\text{Percentage} = \text{Math.round}\left(\frac{\text{Current Coeff}}{120} \times 100\right)$$

This metric serves as a direct performance rating for how much beach surface area will be exposed:
* **80% to 100% (Premium Spring Tide):** Maximum planetary alignment. The water pulls back to extreme physical low limits, leaving a massive, hard-packed, ultra-fast sand flat. Ideal performance window.
* **50% to 79% (Mean/Average Tide):** Standard tidal drop. Good riding space, but soft dry sand traps and tidal channels will sit much closer to your tacking line.
* **Below 50% (Neap Tide):** Weak water movement. The beach remains highly restricted, narrow, and saturated with water. Rolling resistance is high and turn space is dangerously narrow.

---

## 🏖️ Beach Sailing Calibrated Performance Bands

Because damp sand profiles increase physical rolling resistance significantly compared to frictionless paved airfields, these custom thresholds have been intentionally shifted upwards to ensure safety, tracking traction, and apparent wind momentum:

| Status Colour | Wind Speed (km/h) | Riding Experience & Mechanical Characteristics |
| :--- | :--- | :--- |
| **🟥 RED** | 0 - 17 km/h | **Insufficient Wind.** Unable to break static rolling resistance on sand. Frequent stops in soft dry traps. Tacking turns will stall out. |
| **🟨 YELLOW** | 18 - 25 km/h | **Light Fun & Safe.** Ideal cruising zone. Sail builds enough power to stay on top of the hard sand crust cleanly without capsizing risks. Forgiving entry window. |
| **🟩 GREEN** | 26 - 38 km/h | **Peak Performance.** Sail fully pressurized. Apparent wind values multiply acceleration instantly. High speeds across tidal flats. Glides over small tide pools. |
| **🟪 PURPLE** | 39+ km/h | **Expert Only.** High risk of sudden overpowering. Massive lateral lift forces will cause the cart to two-wheel. Requires fast sheet line dumping and advanced reflexes. |

---

## 🧀 Understanding 4-Wedge "Cheese" Map Icons

The map markers feature custom dynamic circular "cheese wheels" split into four distinct numbered quadrants. 

* **Wedge 1 (Top-Right):** Today's Forecast Outlook status.
* **Wedge 2 (Bottom-Right):** Tomorrow's Forecast Window status.
* **Wedge 3 (Bottom-Left):** Day 2 Forecast Window status.
* **Wedge 4 (Top-Left):** Day 3 Forecast Window status.

The inner background paths dynamically color-code to match the precise threshold band predicted for that day's specific low-tide window, giving you a comprehensive 4-day structural overview instantly.

---

## 📍 Adding a New Beach Location

To inject a new sand runway into your tracking matrix, you do not need to modify any core javascript routines. Simply edit the `spots.json` configuration file inside your GitHub code repository and append a new structured object node into the array template:

```json
{
  "name": "Peniche / Baleal",
  "lat": 39.3734,
  "lon": -9.3361,
  "tideforescast": "Peniche",
  "ntfyTopic": "landsail_peniche_2026"
}