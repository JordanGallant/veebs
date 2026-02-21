# Cyber Twin Profile UI

A Next.js frontend for creating your AI-powered digital twin. This multi-step signup flow lets users configure credits, upload their portrait, record their voice, and customize personality traits to generate a personalized AI twin.

## Features

- **3-step signup flow**: Credits → Profile → Generate
- **Credits setup**: Choose AI power credit tier ($10–$100), set monthly spending limit ($0–$1000), connect payment method
- **Profile creation**: Upload portrait photo, record voice for cloning (30+ seconds), select up to 4 personality traits, add custom instructions
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
│   │       ├── CreditStep.tsx  # Credits & payment
│   │       ├── ProfileStep.tsx # Photo, voice, personality
│   │       └── GenerateStep.tsx# Twin generation & reveal
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
