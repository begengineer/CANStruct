export type BitOrder = 'little_endian' | 'big_endian';
export type ValueType = 'unsigned' | 'signed';

export interface CANSignalDef {
  id: string;
  name: string;
  startBit: number;
  length: number;
  factor: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
  bitOrder: BitOrder;
  valueType: ValueType;
}

export interface CANMessageDef {
  id: string;
  canId: number;
  isExtended: boolean;
  name: string;
  dlc: number;
  cycleMs: number;
  nodeId: string;
  signals: CANSignalDef[];
}

export interface CANNodeDef {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

export interface CANFrame {
  id: string;
  timestamp: number;
  canId: number;
  isExtended: boolean;
  dlc: number;
  data: Uint8Array;
  nodeId: string;
  nodeName: string;
  nodeColor: string;
  messageName: string;
  isError: boolean;
  errorType?: 'BIT' | 'STUFF' | 'CRC' | 'FORM' | 'ACK';
}

export interface DecodedSignal {
  frameId: string;
  timestamp: number;
  signalId: string;
  signalName: string;
  messageName: string;
  rawValue: number;
  physicalValue: number;
  unit: string;
}

export interface SimulationState {
  running: boolean;
  timeMs: number;
  frames: CANFrame[];
  signalHistory: Map<string, { timestamp: number; value: number }[]>;
}
