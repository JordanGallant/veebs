# Cyber Twin Profile UI

A Next.js frontend for creating your AI-powered digital twin. This multi-step signup flow lets users sign up, select a subscription, build their twin profile, set a spending limit, and generate a personalized AI twin.

## Features

- **5-step signup flow**: Sign Up → Subscription → Build Twin → Spending Limit → Generate
- **Subscription setup**: Choose a subscription plan and connect payment method
- **Profile creation**: Upload portrait photo, record voice for cloning (30+ seconds), select up to 4 personality traits, add custom instructions
- **Spending control**: Set monthly twin spending limit ($0–$1000)
- **Generation**: Simulated twin creation with progress steps and animated reveal
- **Animations**: GSAP-powered step transitions and micro-interactions
- **Accessibility**: Respects `prefers-reduced-motion` for animations

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **GSAP** – animations
- **Custom fonts**: JetBrains Mono, Apple Garamond

## Project Structure

```
cybertwin-front/
├── app/
│   ├── components/
│   │   ├── SignUpFlow.tsx      # Main wizard orchestrator
│   │   └── steps/
│   │       ├── AccountStep.tsx       # Account creation
│   │       ├── SubscriptionStep.tsx  # Plan selection & payment
│   │       ├── ProfileStep.tsx       # Photo, voice, personality
│   │       ├── SpendingLimitStep.tsx # Monthly spending controls
│   │       └── GenerateStep.tsx      # Twin generation & reveal
│   ├── layout.tsx
│   └── page.tsx
├── styles/
│   ├── main.css
│   ├── base.css
│   ├── colors.css
│   ├── fonts.css
│   └── pages/
│       ├── profile.css
│       └── signup.css
└── public/
    └── fonts/
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

### Production

```bash
npm run start
```

## Environment

No environment variables are required for the current frontend-only setup. Backend integration (e.g. Supabase) can be added later.

## License

Private project.
