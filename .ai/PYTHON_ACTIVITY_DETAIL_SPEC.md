# Python Service – New Endpoints

**Date:** 2026-05-19
**Related branch:** `feat/activity-analytics`
**Service:** `gymcraft-curl-cffi` (the `garth`-based `gymcraft-python-connect` repo is no longer used)

The "AI Performance Coach" iteration adds two endpoints to the Python Garmin proxy. Both follow the existing Flask response convention used by `/authenticate`, `/user-stats`, `/activities`, and `/upload-workout`:

- Success: HTTP 200 with `{"status": "success", "data": ...}`
- Failure: HTTP 400 for missing/invalid params, HTTP 500 for upstream errors, both with `{"status": "error", "message": "..."}`

The SvelteKit side already matches the substring `"No valid token found"` in the error message to detect token expiry (see `src/lib/server/garmin/fetch-activity-detail.ts`). The existing `get_client()` flow in `garmin_service.py` raises `ValueError("No valid token found, and password is required.")`, so that integration works out of the box.

---

## 1. `POST /activity/detail`

Fetch a single Garmin activity with laps + a downsampled HR/speed/elevation time-series. Required for the "Explain my run" feature (per-activity AI analysis) and for HR drift / aerobic decoupling math in later iterations.

### Request

```
POST /activity/detail
Content-Type: application/json

{
    "username": "user@example.com",
    "activityId": 13456789012,
    "password": "secret123"
}
```

| Field        | Type   | Required | Description                                                        |
| ------------ | ------ | -------- | ------------------------------------------------------------------ |
| `username`   | string | yes      | Garmin account email                                               |
| `activityId` | number | yes      | Garmin's numeric activity id (the `activityId` from `/activities`) |
| `password`   | string | no       | Garmin password (only sent when the token has expired)             |

### Implementation

The work is split between `garmin_service.py` (Garmin SDK calls + normalization) and `app.py` (the Flask route):

- `get_activity_detail(client, activity_id)` calls `client.get_activity_details(activity_id)` and `client.get_activity_splits(activity_id)`, then normalizes:
    - **`splits`**: derived from `splits_raw["lapDTOs"]`. Each entry: `{ splitIndex, distanceM, durationSec, averageHr, averageSpeed, elevationGainM, elevationLossM }` (all nullable except `splitIndex`).
    - **`samples`**: derived from the `metricDescriptors` + `activityDetailMetrics` arrays returned by `get_activity_details`. Descriptors map metric keys (`directHeartRate`, `directSpeed`, `directElevation`, `sumElapsedDuration`) to row indices, and each row's `metrics` array carries the values. The raw series is downsampled to **at most 1000 samples** by uniform stride to keep the JSON small enough for the AI prompt and the UI line chart.

### Response

```json
{
    "status": "success",
    "data": {
        "activityId": 13456789012,
        "activityName": "Tempo run",
        "activityType": "running",
        "startTimeGMT": "2026-05-15 09:12:00",
        "duration": 2734.5,
        "distance": 9320.4,
        "splits": [
            {
                "splitIndex": 0,
                "distanceM": 1000,
                "durationSec": 280.4,
                "averageHr": 152,
                "averageSpeed": 3.57,
                "elevationGainM": 4.2,
                "elevationLossM": 2.1
            }
        ],
        "samples": [
            { "timestampSec": 0, "heartRate": 110, "speed": 2.8, "elevationM": 102.1 },
            { "timestampSec": 5, "heartRate": 114, "speed": 3.0, "elevationM": 102.3 }
        ]
    }
}
```

Notes:

- `splits` may be empty for activities without lap data; `samples` may be empty for activities without sample-level metrics. Neither is an error.
- All numeric fields inside `splits` / `samples` are nullable — the normalizer drops `NaN` and `None` values rather than passing them through.

### Additional fields (running dynamics, power, cadence, route)

Each `samples` entry may also carry (nullable, dropped when absent):

```json
{ "timestampSec": 0, "heartRate": 110, "speed": 2.8, "elevationM": 102.1, "cadence": 168, "power": 240 }
```

Two new top-level fields in `data`:

```json
"route": [ { "lat": 50.0611, "lng": 19.9383 } ],
"dynamics": {
    "avgCadence": 168, "maxCadence": 182,
    "avgGroundContactTimeMs": 244, "avgVerticalOscillationCm": 8.9, "avgVerticalRatioPct": 7.1,
    "avgPowerW": 238, "maxPowerW": 402,
    "minTemperatureC": 11.0, "maxTemperatureC": 17.5
}
```

- `route`: raw (untrimmed) GPS points from Garmin, downsampled by uniform stride to at most 300 points. Empty for activities without GPS (treadmill, indoor). The **SvelteKit side trims start/end for privacy** — the Python service returns the full trace.
- `dynamics`: summary-level running-form + power + temperature figures, read from the activity `summaryDTO`. Any field is nullable; the whole object is `null` when none are present.
- `cadence` / `power` per sample come from the `directDoubleCadence` (or `directRunCadence`) and `directPower` metric descriptors when present.

### Error responses

- `400` with `{"status": "error", "message": "..."}` when `username` or `activityId` is missing/invalid.
- `500` with `{"status": "error", "message": "..."}` on any upstream Garmin failure. When the message contains `"No valid token found"`, the SvelteKit side surfaces `INVALID_TOKEN` to prompt the user for a password.

---

## 2. `POST /progress-summary`

Wraps the `garminconnect` library's `get_progress_summary_between_dates` method. Returns lifetime-aggregated stats grouped by activity type for a given metric over a date range. Used for cheap long-range backfill (we don't need to fetch every old activity to chart yearly volume trends).

### Request

```
POST /progress-summary
Content-Type: application/json

{
    "username": "user@example.com",
    "startDate": "2025-01-01",
    "endDate": "2026-05-19",
    "metric": "distance",
    "groupByParentActivityType": true,
    "password": "secret123"
}
```

| Field                       | Type    | Required | Default      | Description                                                               |
| --------------------------- | ------- | -------- | ------------ | ------------------------------------------------------------------------- |
| `username`                  | string  | yes      | —            | Garmin account email                                                      |
| `startDate`                 | string  | yes      | —            | YYYY-MM-DD                                                                |
| `endDate`                   | string  | yes      | —            | YYYY-MM-DD                                                                |
| `metric`                    | string  | no       | `"distance"` | One of: `"distance"`, `"duration"`, `"movingDuration"`, `"elevationGain"` |
| `groupByParentActivityType` | boolean | no       | `true`       | Pass-through to the SDK                                                   |
| `password`                  | string  | no       | —            | Garmin password (only sent when the token has expired)                    |

### Implementation

`get_progress_summary(client, start_date, end_date, metric, group_by_parent_activity_type)` in `garmin_service.py` is a thin wrapper around `client.get_progress_summary_between_dates(...)`. The Flask route just validates inputs and passes the SDK response through inside the `data` wrapper.

### Response

```json
{
    "status": "success",
    "data": [
        {
            "activityType": "running",
            "totalDistance": 1247340,
            "totalDuration": 432000,
            "numberOfActivities": 142
        }
    ]
}
```

Field shape comes directly from the SDK; the SvelteKit side does not strictly type the response yet. The current consumer (`backfillUser` in `src/lib/server/garmin/sync-activities.ts`) only relies on the response existing — it uses these aggregates to short-circuit a full per-activity backfill of older history.

### Error responses

Same convention as `/activity/detail`.

---

## Out of scope for this iteration

Wellness endpoints (`get_sleep_data`, `get_hrv_data`, `get_rhr_day`, `get_stress_data`) are **not** needed yet. They will be required for the "Recovery & Readiness" report in a future iteration — track that as a separate Python service update.

---

## Cross-references in the main app

If the wire shape changes, these files must move in lockstep:

- `src/constants/app.constants.ts` — `internalGarminApiUrlDEV` / `internalGarminApiUrlPROD`.
- `src/lib/server/garmin/fetch-activities.ts` — existing `/activities` consumer.
- `src/lib/server/garmin/fetch-activity-detail.ts` — `/activity/detail` consumer.
- `src/lib/server/garmin/sync-activities.ts` — orchestrates backfill + incremental sync. (Will gain a call to `/progress-summary` when long-range backfill is added.)
