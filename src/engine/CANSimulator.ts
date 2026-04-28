import { v4 as uuidv4 } from 'uuid';
import type {
  CANNodeDef, CANMessageDef, CANSignalDef,
  CANFrame, DecodedSignal, SimulationState,
} from './types';
import { decodeSignal, encodeSignal } from './signalCodec';

export type SimEventListener = (
  event: 'frame' | 'signal' | 'tick',
  payload: CANFrame | DecodedSignal[] | number,
) => void;

const NODE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
];

export class CANSimulator {
  nodes: CANNodeDef[] = [];
  messages: CANMessageDef[] = [];

  private state: SimulationState = {
    running: false,
    timeMs: 0,
    frames: [],
    signalHistory: new Map(),
  };

  private listeners: SimEventListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextCycle: Map<string, number> = new Map();
  private errorRate = 0.005;
  private tickMs = 10;

  constructor() {
    this.loadDefaults();
  }

  private loadDefaults() {
    this.nodes = [
      { id: 'node_engine', name: 'Engine ECU', color: NODE_COLORS[0], active: true },
      { id: 'node_trans', name: 'Transmission ECU', color: NODE_COLORS[1], active: true },
      { id: 'node_abs', name: 'ABS ECU', color: NODE_COLORS[2], active: true },
    ];
    this.messages = [
      {
        id: 'msg_engine_status', canId: 0x100, isExtended: false,
        name: 'ENGINE_STATUS', dlc: 8, cycleMs: 10, nodeId: 'node_engine',
        signals: [
          { id: 'sig_rpm', name: 'EngineRPM', startBit: 0, length: 16, factor: 0.25, offset: 0, min: 0, max: 16383.75, unit: 'rpm', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_throttle', name: 'ThrottlePos', startBit: 16, length: 8, factor: 0.392157, offset: 0, min: 0, max: 100, unit: '%', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_coolant', name: 'CoolantTemp', startBit: 24, length: 8, factor: 1, offset: -40, min: -40, max: 215, unit: '°C', bitOrder: 'little_endian', valueType: 'unsigned' },
        ],
      },
      {
        id: 'msg_wheel_speed', canId: 0x200, isExtended: false,
        name: 'WHEEL_SPEED', dlc: 8, cycleMs: 20, nodeId: 'node_abs',
        signals: [
          { id: 'sig_speed_fl', name: 'SpeedFL', startBit: 0, length: 16, factor: 0.01, offset: 0, min: 0, max: 655.35, unit: 'km/h', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_speed_fr', name: 'SpeedFR', startBit: 16, length: 16, factor: 0.01, offset: 0, min: 0, max: 655.35, unit: 'km/h', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_speed_rl', name: 'SpeedRL', startBit: 32, length: 16, factor: 0.01, offset: 0, min: 0, max: 655.35, unit: 'km/h', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_speed_rr', name: 'SpeedRR', startBit: 48, length: 16, factor: 0.01, offset: 0, min: 0, max: 655.35, unit: 'km/h', bitOrder: 'little_endian', valueType: 'unsigned' },
        ],
      },
      {
        id: 'msg_gear', canId: 0x300, isExtended: false,
        name: 'TRANS_DATA', dlc: 4, cycleMs: 50, nodeId: 'node_trans',
        signals: [
          { id: 'sig_gear', name: 'GearPos', startBit: 0, length: 4, factor: 1, offset: 0, min: 0, max: 8, unit: '', bitOrder: 'little_endian', valueType: 'unsigned' },
          { id: 'sig_gear_mode', name: 'GearMode', startBit: 4, length: 2, factor: 1, offset: 0, min: 0, max: 3, unit: '', bitOrder: 'little_endian', valueType: 'unsigned' },
        ],
      },
    ];
  }

  addNode(name: string): CANNodeDef {
    const node: CANNodeDef = { id: uuidv4(), name, color: NODE_COLORS[this.nodes.length % NODE_COLORS.length], active: true };
    this.nodes.push(node);
    return node;
  }
  removeNode(id: string) { this.nodes = this.nodes.filter(n => n.id !== id); this.messages = this.messages.filter(m => m.nodeId !== id); }
  updateNode(id: string, patch: Partial<CANNodeDef>) { const node = this.nodes.find(n => n.id === id); if (node) Object.assign(node, patch); }
  addMessage(msg: Omit<CANMessageDef, 'id'>): CANMessageDef { const full: CANMessageDef = { ...msg, id: uuidv4() }; this.messages.push(full); return full; }
  removeMessage(id: string) { this.messages = this.messages.filter(m => m.id !== id); }
  updateMessage(id: string, patch: Partial<Omit<CANMessageDef, 'id'>>) { const msg = this.messages.find(m => m.id === id); if (msg) Object.assign(msg, patch); }
  addSignal(messageId: string, sig: Omit<CANSignalDef, 'id'>): CANSignalDef { const msg = this.messages.find(m => m.id === messageId); if (!msg) throw new Error('Message not found'); const full: CANSignalDef = { ...sig, id: uuidv4() }; msg.signals.push(full); return full; }
  removeSignal(messageId: string, signalId: string) { const msg = this.messages.find(m => m.id === messageId); if (msg) msg.signals = msg.signals.filter(s => s.id !== signalId); }

  start() {
    if (this.state.running) return;
    this.state.running = true; this.state.timeMs = 0; this.state.frames = []; this.state.signalHistory = new Map(); this.nextCycle = new Map();
    this.messages.forEach(m => this.nextCycle.set(m.id, 0));
    this.intervalId = setInterval(() => this.tick(), this.tickMs);
  }
  stop() { this.state.running = false; if (this.intervalId !== null) { clearInterval(this.intervalId); this.intervalId = null; } this.emit('tick', this.state.timeMs); }
  reset() { this.stop(); this.state.timeMs = 0; this.state.frames = []; this.state.signalHistory = new Map(); this.nextCycle = new Map(); }
  isRunning() { return this.state.running; }
  getTimeMs() { return this.state.timeMs; }
  getFrames() { return this.state.frames; }
  getSignalHistory() { return this.state.signalHistory; }
  setErrorRate(rate: number) { this.errorRate = Math.max(0, Math.min(1, rate)); }

  sendFrame(canId: number, isExtended: boolean, data: Uint8Array, nodeId: string) {
    const node = this.nodes.find(n => n.id === nodeId) ?? this.nodes[0];
    const msg = this.messages.find(m => m.canId === canId);
    const frame = this.buildFrame(canId, isExtended, data, node, msg?.name ?? 'MANUAL', false);
    this.publishFrame(frame);
  }

  injectError(type: CANFrame['errorType']) {
    const node = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    const frame: CANFrame = { id: uuidv4(), timestamp: this.state.timeMs, canId: 0x000, isExtended: false, dlc: 0, data: new Uint8Array(0), nodeId: node.id, nodeName: node.name, nodeColor: node.color, messageName: 'ERROR FRAME', isError: true, errorType: type };
    this.publishFrame(frame);
  }

  private tick() {
    this.state.timeMs += this.tickMs;
    const t = this.state.timeMs;
    for (const msg of this.messages) {
      if (msg.cycleMs === 0) continue;
      const next = this.nextCycle.get(msg.id) ?? 0;
      if (t < next) continue;
      this.nextCycle.set(msg.id, t + msg.cycleMs);
      const node = this.nodes.find(n => n.id === msg.nodeId);
      if (!node || !node.active) continue;
      if (Math.random() < this.errorRate) {
        const types: CANFrame['errorType'][] = ['BIT', 'STUFF', 'CRC', 'FORM', 'ACK'];
        this.injectError(types[Math.floor(Math.random() * types.length)]);
        continue;
      }
      const data = this.generateData(msg, t);
      const frame = this.buildFrame(msg.canId, msg.isExtended, data, node, msg.name, false);
      this.publishFrame(frame);
    }
    this.emit('tick', t);
  }

  private generateData(msg: CANMessageDef, t: number): Uint8Array {
    const data = new Uint8Array(msg.dlc);
    for (const sig of msg.signals) {
      let value = 0;
      switch (sig.id) {
        case 'sig_rpm': value = 800 + 2000 * (0.5 + 0.5 * Math.sin(t / 3000)) + (Math.random() - 0.5) * 50; break;
        case 'sig_throttle': value = 20 + 40 * (0.5 + 0.5 * Math.sin(t / 4000)) + (Math.random() - 0.5) * 2; break;
        case 'sig_coolant': value = 80 + 10 * Math.sin(t / 10000); break;
        case 'sig_speed_fl': case 'sig_speed_fr': case 'sig_speed_rl': case 'sig_speed_rr': { const base = 60 + 40 * Math.sin(t / 5000); value = base + (Math.random() - 0.5) * 0.5; break; }
        case 'sig_gear': value = Math.max(1, Math.min(6, Math.floor(1 + (t % 12000) / 2000))); break;
        case 'sig_gear_mode': value = 1; break;
        default: value = sig.min + (sig.max - sig.min) * (0.5 + 0.5 * Math.sin(t / 2000 + sig.startBit));
      }
      value = Math.max(sig.min, Math.min(sig.max, value));
      encodeSignal(data, sig, value);
    }
    return data;
  }

  private buildFrame(canId: number, isExtended: boolean, data: Uint8Array, node: CANNodeDef, messageName: string, isError: boolean): CANFrame {
    return { id: uuidv4(), timestamp: this.state.timeMs, canId, isExtended, dlc: data.length, data: new Uint8Array(data), nodeId: node.id, nodeName: node.name, nodeColor: node.color, messageName, isError };
  }

  private publishFrame(frame: CANFrame) {
    this.state.frames.push(frame);
    if (this.state.frames.length > 2000) this.state.frames = this.state.frames.slice(-2000);
    this.emit('frame', frame);
    if (!frame.isError) {
      const msg = this.messages.find(m => m.canId === frame.canId);
      if (msg) {
        const decoded = this.decodeFrame(frame, msg);
        decoded.forEach(d => {
          const hist = this.state.signalHistory.get(d.signalId) ?? [];
          hist.push({ timestamp: d.timestamp, value: d.physicalValue });
          if (hist.length > 500) hist.splice(0, hist.length - 500);
          this.state.signalHistory.set(d.signalId, hist);
        });
        this.emit('signal', decoded);
      }
    }
  }

  private decodeFrame(frame: CANFrame, msg: CANMessageDef): DecodedSignal[] {
    return msg.signals.map(sig => ({ frameId: frame.id, timestamp: frame.timestamp, signalId: sig.id, signalName: sig.name, messageName: msg.name, rawValue: 0, physicalValue: decodeSignal(frame.data, sig), unit: sig.unit }));
  }

  on(listener: SimEventListener) { this.listeners.push(listener); }
  off(listener: SimEventListener) { this.listeners = this.listeners.filter(l => l !== listener); }
  private emit(event: 'frame' | 'signal' | 'tick', payload: CANFrame | DecodedSignal[] | number) { this.listeners.forEach(l => l(event, payload)); }
}

export const simulator = new CANSimulator();
