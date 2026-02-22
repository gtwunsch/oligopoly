# Global Macro – Investment Simulator

A turn-based global macro investment simulator inspired by Democracy 4.
You play as the CEO of the world's largest bank, making investment decisions each quarter while the simulation updates markets, countries, and sentiment.

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

## Next Improvements

- More countries and regional dynamics
- Policy decisions (lobby central banks, capital controls)
- Multi-turn event chains and crises
- Achievements and scoring leaderboard
- Sound effects and animations
- Detailed country drill-down view
- Sector-level equity investing
- Trade relationships between countries
- Difficulty levels and scenarios
