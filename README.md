# GymCraft - AI Powered Personal Trainer

![GymCraft](https://github.com/DamianWrooby/gym-craft/blob/main/src/lib/images/gym-craft-logo-crop.png)

Welcome to the GymCraft - web app powered by GenAI that helps amateur athletes train smarter. Generate personalized gym plans, sync them to Garmin, and get coach-grade weekly reviews of your running with conversational AI for every activity.

https://github.com/user-attachments/assets/6ca0492a-74ec-402e-9f93-c15612cb136c

## Table of Contents

- [GymCraft - AI Powered Personal Trainer](#gymcraft---ai-powered-personal-trainer)
    - [Table of Contents](#table-of-contents)
    - [Project Overview](#project-overview)
    - [How does it work?](#how-does-it-work)
    - [Garmin Connect Integration](#garmin-connect-integration)
    - [Running Analytics Dashboard](#running-analytics-dashboard)
    - [Training Reports & AI Performance Coach](#training-reports--ai-performance-coach)
    - [Athlete Profile & Running Goals](#athlete-profile--running-goals)
    - [Technologies Used](#technologies-used)
    - [Architecture Schema](#architecture-schema)
    - [Production Link](#production-link)
    - [Getting Started (local installation)](#getting-started-local-installation)
        - [Prerequisites](#prerequisites)
        - [Installation](#installation)
        - [Running the Application](#running-the-application)
    - [License](#license)
    - [Contact](#contact)

## Project Overview

GymCraft has two product surfaces:

- **Gym side** — customized fitness plans generated from the user's goals, current condition, and preferences, with one-click sync to Garmin devices.
- **Running side** — Garmin activity sync, weekly coach-style training reports with training-load analytics (TRIMP, ACWR, monotony), and per-activity conversational AI that answers free-form questions about any of your runs.

**New:** GymCraft now features seamless [Garmin Connect™](https://connect.garmin.com/) integration, allowing users to sync AI-generated workout plans directly to their Garmin devices.

**Also new:** a full running analytics dashboard — a training-load snapshot, a searchable/filterable activity history, per-activity HR & pace charts, and an athlete profile with running goals that sharpen every AI report and coaching answer.

https://github.com/user-attachments/assets/PASTE_RUNNING_FEATURES_VIDEO_ID_HERE

## How does it work?

The user enters data through a clear form and GymCraft under the hood configures the AI model accordingly and enriches that data using prompt engineering techniques to produce the best quality results.

To bypass the Netlify serverless functions 10s timeout when calling external OpenAI API, application uses [GymCraft - Proxy](https://github.com/DamianWrooby/gym-craft-ai-proxy) - additional Express.js server.

## Garmin Connect Integration

https://github.com/user-attachments/assets/b215e70c-7f59-4018-a3af-7b2d9946254d

Effortlessly sync your AI-generated workout plans with your Garmin Connect™ account. With just a click, you can:

- Securely connect your Garmin account
- Export training plans in one step
- Access workouts on your Garmin watch or app
- Track progress and adapt plans in real time

This integration is designed for a frictionless experience—no manual file transfers or complex setup required.

## Running Analytics Dashboard

For runners, GymCraft reads your Garmin training history and turns it into coach-grade insight.

### Activity sync

Imports up to 120 days of activities from Garmin Connect on first connection, then keeps them in sync incrementally with every visit. Activities are stored in the database — no repeated Garmin calls to browse your history.

### Dashboard

Land on `/app/running` and get an at-a-glance snapshot: current training-load status (Undertraining · Optimal · Overreach · High risk) with ACWR, 7-day distance, monotony, and weekly session count, plus previews of your most recent activities and weekly reports.

### Activity history

A dedicated, filterable activity list — pick a date range, choose how many rows per page, and page through your full training history without waiting on Garmin's API.

### Activity detail

Click into any run for the full picture: key stats up top (distance, duration, pace, heart rate), an interactive heart-rate-and-pace overlay chart showing how effort evolved through the run, and a kilometer-by-kilometer splits table.

## Training Reports & AI Performance Coach

### Weekly training reports

A coach-style markdown review of the week, broken into six sections:

1. **Summary** — headline of the week.
2. **Volume & consistency** — distribution across the week.
3. **Intensity quality** — time in heart-rate zones and what it implies.
4. **Efficiency & response** — pace, HR, and week-over-week deltas.
5. **Training load & risk** — interpreted using TRIMP-based metrics.
6. **Recommended adjustments for next week** — concrete actions (intensity %, session mix, what to add/avoid) plus a one-line _Fatigue Risk · Readiness · Adaptation_ status.

Each report includes a **Training Load card** showing:

| Metric                     | What it means                                       |
| -------------------------- | --------------------------------------------------- |
| **Acute load (7d avg)**    | Recent training stress                              |
| **Chronic load (28d avg)** | Fitness baseline you've built up                    |
| **ACWR**                   | Acute ÷ chronic — sweet spot 0.8–1.3, spike > 1.5   |
| **Monotony (7d)**          | How uniform your week was — > 2.0 limits adaptation |
| **Weekly load Δ**          | Percent change vs the previous week                 |

A status badge — _Under-training · Optimal · Overreaching · High risk_ — colour-codes your current state at a glance, with hover tooltips explaining each metric in plain English.

Beyond the written review, each report renders week-over-week stat deltas, a daily volume bar chart, a heart-rate-zone donut, and a pace-vs-heart-rate scatter — and can be exported for your own records.

### "Explain my run"

Open any activity and ask the coach a free-form question. One-click prompts like _"Why did I fade?"_, _"Was my pacing good?"_, _"Was this productive?"_, and _"How does this compare to my recent runs?"_ are at the top. The AI grounds its answer in:

- That activity's splits and HR/pace samples
- Your last 14 days of training
- Your current load profile (acute / chronic / ACWR / monotony)
- Your athlete profile (HR bounds, VO2max, sex, age)

It never invents numbers, never diagnoses injuries, and stays within 3–5 short paragraphs. Powered by the same OpenAI proxy that handles plan generation, with a per-user daily rate limit.

## Athlete Profile & Running Goals

Set up your athlete profile — heart-rate zones, resting/max HR, VO2max, sex, age — and add priority-ordered running goals (race, base building, tempo work, recovery). GymCraft feeds this context into every weekly report and every "Explain my run" answer, so recommendations are tailored to what you're actually training for.

## Technologies Used

- **SvelteKit**: A modern framework for building fast and high-performance fullstack web applications.
- **OpenAI API**: communication with GPT model
- **Node.js**: Proxy server
- **Python**: microservice responsible for communication with Garmin Connect
- **Vite**: Build tool for optimized performance
- **Prisma**: ORM for communication with PostgreSQL DB
- **Skeleton**: UI library
- **Tailwind**: CSS framework

## Architecture Schema

![GymCraft Architecture](https://github.com/DamianWrooby/gym-craft/blob/main/src/lib/images/gym-craft-arch-schema.jpg)

## Production Link

You can check out the live application at [this link](https://gym-craft.netlify.app/).

## Getting Started (local installation)

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (version 18.x or higher)
- npm (version 10.x or higher)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/DamianWrooby/gym-craft.git
    cd gym-craft
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

### Running the Application

1. Start the development server:

    ```bash
    npm run dev
    ```

2. Open your browser and navigate to http://localhost:5173/ to see the application in action.

## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/license/mit) file for details.

## Contact

If you have any questions, feel free to reach out:

Email: 👉🏼 **dwroblewski89@gmail.com**  
GitHub: [DamianWrooby](https://github.com/DamianWrooby)
