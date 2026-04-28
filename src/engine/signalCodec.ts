import type { CANSignalDef } from './types';

export function decodeSignal(data: Uint8Array, sig: CANSignalDef): number {
  let rawBits = 0n;

  if (sig.bitOrder === 'little_endian') {
    for (let i = 0; i < sig.length; i++) {
      const bitPos = sig.startBit + i;
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = bitPos % 8;
      if (byteIdx < data.length && (data[byteIdx] >> bitIdx) & 1) {
        rawBits |= 1n << BigInt(i);
      }
    }
  } else {
    let bitPos = sig.startBit;
    for (let i = 0; i < sig.length; i++) {
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = 7 - (bitPos % 8);
      if (byteIdx < data.length && (data[byteIdx] >> bitIdx) & 1) {
        rawBits |= 1n << BigInt(sig.length - 1 - i);
      }
      if (bitPos % 8 === 0) {
        bitPos += 15;
      } else {
        bitPos--;
      }
    }
  }

  let numeric = Number(rawBits);
  if (sig.valueType === 'signed' && rawBits & (1n << BigInt(sig.length - 1))) {
    numeric = Number(rawBits - (1n << BigInt(sig.length)));
  }
  return numeric * sig.factor + sig.offset;
}

export function encodeSignal(data: Uint8Array, sig: CANSignalDef, physicalValue: number): void {
  const rawValue = Math.round((physicalValue - sig.offset) / sig.factor);
  const mask = (1 << sig.length) - 1;
  const bits = rawValue & mask;

  if (sig.bitOrder === 'little_endian') {
    for (let i = 0; i < sig.length; i++) {
      const bitPos = sig.startBit + i;
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = bitPos % 8;
      if (byteIdx < data.length) {
        if ((bits >> i) & 1) {
          data[byteIdx] |= 1 << bitIdx;
        } else {
          data[byteIdx] &= ~(1 << bitIdx);
        }
      }
    }
  } else {
    let bitPos = sig.startBit;
    for (let i = 0; i < sig.length; i++) {
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = 7 - (bitPos % 8);
      if (byteIdx < data.length) {
        if ((bits >> (sig.length - 1 - i)) & 1) {
          data[byteIdx] |= 1 << bitIdx;
        } else {
          data[byteIdx] &= ~(1 << bitIdx);
        }
      }
      if (bitPos % 8 === 0) {
        bitPos += 15;
      } else {
        bitPos--;
      }
    }
  }
}
