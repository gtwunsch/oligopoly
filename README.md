# Oligopoly — Global Macro Investment Simulator

You run the world's most powerful bank. Your trades move markets, topple currencies, and reshape economies. Every decision ripples outward — and eventually ripples back.

A turn-based strategy game about global finance, systemic risk, and the uncomfortable power of capital. Inspired by Democracy 4's interconnected systems.

## Quick Start

```bash
npm install
npm run dev
```

## Tech Stack

- React + TypeScript + Vite
- Zustand (state management)
- Recharts (charts)
- LocalStorage (save/load)

## Project Structure

```
src/
  sim/          Pure simulation engine (no React deps)
    types.ts    Core type definitions
    rng.ts      Seeded deterministic RNG
    countries.ts Sample country data
    decisions.ts Declarative decision definitions
    events.ts   Weighted random event system
    engine.ts   Main simulation tick logic
  store/
    gameStore.ts Zustand store with save/load
  components/   React UI components
  App.tsx       Root component
  index.css     All styles
```

## Gameplay

- **Start** a new game or continue a saved one
- **Queue decisions** each quarter (buy bonds, short currencies, adjust leverage, etc.)
- **End Turn** to advance the simulation
- Watch countries react: rates, inflation, growth, stability, FX, sentiment
- Manage your portfolio risk and grow your AUM
- Game over if AUM drops below $20B

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full product roadmap covering MVP through v2, including the boilerplate audit and prioritized next steps.
