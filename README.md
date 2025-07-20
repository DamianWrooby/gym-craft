# GymCraft - AI Powered Personal Trainer

![GymCraft](https://github.com/DamianWrooby/gym-craft/blob/main/src/lib/images/gym-craft-logo-crop.png)

Welcome to the GymCraft - web app powered by GenAI that allows users to create personalized fitness training plans based on the provided information.

![Demo](https://github.com/user-attachments/assets/6ca0492a-74ec-402e-9f93-c15612cb136c)

## Table of Contents

- [GymCraft - AI Powered Personal Trainer](#gymcraft---ai-powered-personal-trainer)
	- [Table of Contents](#table-of-contents)
	- [Project Overview](#project-overview)
	- [How does it work?](#how-does-it-work)
	- [Garmin Connect Integration](#garmin-connect-integration)
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

This app is designed to help users create customized fitness plans. By inputting their data, such as fitness goals, current physical condition, and preferences, users can receive tailored workout plans generated with the help of the GenAI.

**New:** GymCraft now features seamless [Garmin Connect™](https://connect.garmin.com/) integration, allowing users to sync AI-generated workout plans directly to their Garmin devices.

## How does it work?

The user enters data through a clear form and GymCraft under the hood configures the AI model accordingly and enriches that data using prompt engineering techniques to produce the best quality results.

To bypass the Netlify serverless functions 10s timeout when calling external OpenAI API, application uses [GymCraft - Proxy](https://github.com/DamianWrooby/gym-craft-ai-proxy) - additional Express.js server.

## Garmin Connect Integration

![Garmin](https://github.com/DamianWrooby/gym-craft/blob/main/src/lib/videos/Garmin-demo.mp4)

Effortlessly sync your AI-generated workout plans with your Garmin Connect™ account. With just a click, you can:

- Securely connect your Garmin account
- Export training plans in one step
- Access workouts on your Garmin watch or app
- Track progress and adapt plans in real time

This integration is designed for a frictionless experience—no manual file transfers or complex setup required. 

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
