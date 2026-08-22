# Context

The ubiquitous language of GymCraft. Definitions only — decisions and their reasoning live in `docs/adr/`.

## Athlete & training

**Activity** — one recorded bout of movement, as Garmin reports it. Not every activity is training.

**Training activity** — an activity the athlete undertook as training. Walking is not a training activity: Garmin's Move IQ creates walking records the athlete never started, so a walk is treated as incidental movement rather than training. Hiking is a training activity.

**Session** — a training activity, counted. Session counts never include non-training activities, so a session count will not match a raw count of recorded activities.

**Modality** — the sport a training activity belongs to, in the four buckets used for distance reporting: **running**, **cycling**, **swimming**, and **other**. "Other" is a remainder, not a sport: it holds every training activity that is none of the first three, including composite activities such as triathlons whose single distance spans several disciplines.

**Cross-training** — training that is not running. Distinct from the "other" modality: a bike ride is cross-training but belongs to the cycling modality. Every non-running modality is cross-training.

## Load & volume

**Training load** — the physiological stress of a training activity, expressed as TRIMP. Load is **all-modality**: a hard ride and a hard run both contribute, because cardiovascular stress accumulates regardless of sport. Load is never running-specific.

**Acute load** — average daily training load over the last 7 days.

**Chronic load** — average daily training load over the last 28 days; the athlete's accumulated base.

**ACWR** — the ratio of acute to chronic load, interpreted as a training status: _undertraining_, _optimal_, _overreach_, or _high-risk_.

**Monotony** — how evenly load is distributed across the days of a week. High monotony means every day looks alike, which is a risk signal regardless of total load.

**Strain** — weekly load weighted by monotony.

**Volume** — how much running was done, in distance and duration. Unlike load, volume is **running-only**.

**Distance** — ground covered, always reported per modality and never summed across them: a kilometre swum is not a kilometre run, so a total across modalities is not a quantity. The one exception is the "other" bucket, which is an explicit mixed sum and labelled as such.

## Garmin access

**Garmin authorization** — the durable permission an athlete grants by entering their Garmin password once. It outlives any single session and can be exercised again without the athlete. Only the athlete can restore it once Garmin withdraws it, which happens when they change their password, enable MFA, or revoke access.

**Garmin session** — an athlete's short-lived permission to reach Garmin through GymCraft. Minted from a Garmin authorization and renewable from it silently, so an expired session is never a reason to ask the athlete for anything. Distinct from the athlete's GymCraft login, which is a different thing wearing the same word.

**Re-authentication** — asking the athlete for their Garmin password. Justified only when the authorization is dead, never when a session has merely expired and never when Garmin is throttling: in both of those cases the credentials are correct.

## Reporting

**Weekly report** — a coach-style review of one Monday–Sunday period, combining running volume, intensity and efficiency with all-modality load, and summarised by AI.

**Report preview** — the short, markdown-stripped teaser of a weekly report's AI summary, shown as one line in a report list. Distinct from the summary itself: the preview is display text a list surface renders, never the full report. List queries carry the preview, not the summary, so full report text is never fetched to render a list.

**Load profile** — the all-modality load figures attached to a weekly report: acute, chronic, ACWR, monotony and strain.

**Running analytics** — the product surface on which an athlete reviews their synced activities: load profile, per-modality distance, recent sessions and weekly reports. Named for the athlete it serves, not the data it covers. The surface reports all-modality load, so "running load" is never a valid phrase — in the product, in its marketing, or in the code.

## Activity detail

**Running dynamics** — the running-form metrics Garmin records for an activity: cadence, ground contact time, vertical oscillation, vertical ratio and stride length. They belong to the running modality only, and are never reported for cycling, swimming or other.

**Aerobic decoupling** — the change in an activity's pace-to-heart-rate ratio between its first half and its second half. A durability signal for one effort, distinct from training load: decoupling describes a single activity, load accumulates across many.

**Route thumbnail** — a static, non-interactive rendering of an activity's GPS trace. Its start and end points are trimmed so the athlete's home location is never exposed. Deliberately not a map: it does not pan, zoom, or show a basemap.

**Explain my run** — the per-activity AI analysis an athlete requests from the activity detail surface. A running feature: offered only for running-modality activities, never for cross-training. Distinct from the weekly report, which reviews a period; Explain my run reviews one training activity.
