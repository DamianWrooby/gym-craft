# GymCraft - AI Powered Personal Trainer

![GymCraft](https://github.com/DamianWrooby/gym-craft/blob/main/src/lib/images/gym-craft-logo-crop.png)

Welcome to the GymCraft! This project is a SvelteKit application powered by Chat-GPT that allows users to create personalized fitness training plans based on the data they provide.

## Table of Contents

- [Project Overview](#project-overview)
  - [How does it work?](#how-does-it-work)
- [Technologies Used](#technologies-used)
- [Production Link](#production-link)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [License](#license)
- [Contact](#contact)

## Project Overview

This app is designed to help users create customized fitness plans. By inputting their data, such as fitness goals, current physical condition, and preferences, users can receive tailored workout plans generated with the help of the Chat-GPT model. 

## How does it work?

The user enters data through a clear form and GymCraft under the hood configures the AI model accordingly and enriches that data using prompt engineering techniques to produce the best quality results.

To bypass the Netlify serverless functions 10s timeout when calling external OpenAI API, application uses [GymCraft - Proxy](https://github.com/DamianWrooby/gym-craft-ai-proxy) - additional Express.js server.

## Technologies Used

- **SvelteKit**: A modern framework for building fast and high-performance fullstack web applications.
- **OpenAI GPT-4**: For generating personalized fitness plans.
- **Node.js**: Backend runtime environment.
- **Vite**: Build tool for optimized performance.
- **Prisma**: ORM for communication with the database.
- **Skeleton**: UI library.
- **Tailwind**: Utility-first CSS framework.

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