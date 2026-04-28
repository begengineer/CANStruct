# CANStruct

CAN bus simulator & visualizer built with React + TypeScript + Vite.

## Features

- **Bus Monitor** — Real-time frame log with filter
- **Bus Timeline** — Canvas-based per-node frame timeline
- **Signal Graph** — Time-series decoded signal plot (recharts)
- **Frame Waveform** — SVG bit-level waveform (SOF/ID/DLC/Data/CRC/ACK/EOF)
- **Network Topology** — Animated canvas showing ECU nodes on CAN bus with packet flow
- **Network Config** — Add/edit/delete nodes, messages, signals
- **Control Panel** — Start/stop/reset, error injection, manual frame send

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

- React 18 + TypeScript
- Vite
- recharts
- lucide-react
- uuid
