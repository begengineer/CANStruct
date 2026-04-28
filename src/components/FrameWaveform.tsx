import { useState } from 'react';
import type { CANFrame } from '../engine/types';

interface Props { frame: CANFrame | null; }
interface BitSegment { label: string; bits: number[]; color: string; description: string; }

function frameToSegments(frame: CANFrame): BitSegment[] {
  const segments: BitSegment[] = [];
  segments.push({ label: 'SOF', bits: [0], color: '#6366f1', description: 'Start of Frame (1 bit, dominant)' });
  const idBits: number[] = [];
  for (let i = 10; i >= 0; i--) idBits.push((frame.canId >> i) & 1);
  segments.push({ label: 'ID', bits: idBits, color: '#3b82f6', description: `Arbitration ID: 0x${frame.canId.toString(16).toUpperCase().padStart(3, '0')} (11 bits)` });
  segments.push({ label: 'RTR', bits: [0], color: '#8b5cf6', description: 'Remote Transmission Request (0=data frame)' });
  segments.push({ label: 'IDE', bits: [0], color: '#a78bfa', description: 'Identifier Extension (0=standard frame)' });
  segments.push({ label: 'r0', bits: [0], color: '#c4b5fd', description: 'Reserved bit' });
  const dlcBits: number[] = [];
  for (let i = 3; i >= 0; i--) dlcBits.push((frame.dlc >> i) & 1);
  segments.push({ label: 'DLC', bits: dlcBits, color: '#10b981', description: `Data Length Code: ${frame.dlc} bytes` });
  for (let b = 0; b < frame.dlc; b++) {
    const byteBits: number[] = [];
    for (let i = 7; i >= 0; i--) byteBits.push((frame.data[b] >> i) & 1);
    segments.push({ label: `D${b}`, bits: byteBits, color: '#f59e0b', description: `Data byte ${b}: 0x${frame.data[b].toString(16).toUpperCase().padStart(2, '0')} (${frame.data[b]})` });
  }
  segments.push({ label: 'CRC', bits: Array(15).fill(0), color: '#ef4444', description: 'CRC field (15 bits)' });
  segments.push({ label: 'DEL', bits: [1], color: '#f87171', description: 'CRC delimiter (recessive)' });
  segments.push({ label: 'ACK', bits: [0], color: '#06b6d4', description: 'ACK slot (dominant=acknowledged)' });
  segments.push({ label: 'DEL', bits: [1], color: '#67e8f9', description: 'ACK delimiter (recessive)' });
  segments.push({ label: 'EOF', bits: [1, 1, 1, 1, 1, 1, 1], color: '#84cc16', description: 'End of Frame (7 recessive bits)' });
  return segments;
}

const BIT_W = 12; const BIT_H = 32; const WAVE_H = 40; const TOTAL_H = WAVE_H + BIT_H + 40;

export function FrameWaveform({ frame }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  if (!frame || frame.isError) return (
    <div className="frame-waveform"><h2>Frame Waveform</h2><div className="empty-waveform"><p>バスモニタのフレームを選択すると波形が表示されます</p></div></div>
  );
  const segments = frameToSegments(frame);
  const allBits: { bit: number; seg: BitSegment }[] = [];
  segments.forEach(seg => seg.bits.forEach(bit => allBits.push({ bit, seg })));
  const totalW = allBits.length * BIT_W;
  let path = '';
  allBits.forEach((b, i) => {
    const y = b.bit === 1 ? 8 : WAVE_H - 8;
    const x = i * BIT_W;
    if (i === 0) { path += `M ${x} ${y} `; }
    else { const prevY = allBits[i - 1].bit === 1 ? 8 : WAVE_H - 8; if (prevY !== y) path += `L ${x} ${prevY} L ${x} ${y} `; else path += `L ${x} ${y} `; }
  });
  let bitCursor = 0;
  const segRects = segments.map(seg => { const x = bitCursor * BIT_W; const w = seg.bits.length * BIT_W; bitCursor += seg.bits.length; return { x, w, seg }; });
  return (
    <div className="frame-waveform">
      <h2>Frame Waveform</h2>
      <div className="waveform-info">
        <span>ID: 0x{frame.canId.toString(16).toUpperCase().padStart(3, '0')}</span>
        <span>{frame.messageName}</span><span>DLC: {frame.dlc}</span><span>{frame.nodeName}</span><span className="mono">T={frame.timestamp}ms</span>
      </div>
      <div className="svg-scroll">
        <svg width={totalW + 20} height={TOTAL_H} style={{ display: 'block', minWidth: totalW + 20 }} onMouseLeave={() => setTooltip(null)}>
          <line x1={0} y1={8} x2={totalW} y2={8} stroke="#374151" strokeDasharray="2 4" />
          <text x={totalW + 2} y={12} fill="#6b7280" fontSize={9}>H (recessive)</text>
          <line x1={0} y1={WAVE_H - 8} x2={totalW} y2={WAVE_H - 8} stroke="#374151" strokeDasharray="2 4" />
          <text x={totalW + 2} y={WAVE_H - 4} fill="#6b7280" fontSize={9}>L (dominant)</text>
          <path d={path} fill="none" stroke="#22d3ee" strokeWidth={2} />
          {allBits.map((b, i) => (<rect key={i} x={i * BIT_W} y={WAVE_H + 4} width={BIT_W - 1} height={BIT_H} fill={b.seg.color} opacity={0.7} rx={1} style={{ cursor: 'pointer' }} onMouseEnter={e => setTooltip({ x: e.currentTarget.getBoundingClientRect().x, y: e.currentTarget.getBoundingClientRect().y, text: b.seg.description })} />))}
          {allBits.map((b, i) => (<text key={i} x={i * BIT_W + BIT_W / 2} y={WAVE_H + 4 + BIT_H / 2 + 5} textAnchor="middle" fill="white" fontSize={9} fontFamily="monospace" style={{ pointerEvents: 'none' }}>{b.bit}</text>))}
          {segRects.map((r, i) => (<g key={i}><line x1={r.x} y1={WAVE_H + 4 + BIT_H + 4} x2={r.x + r.w} y2={WAVE_H + 4 + BIT_H + 4} stroke={r.seg.color} strokeWidth={2} />{r.w > 14 && (<text x={r.x + r.w / 2} y={WAVE_H + 4 + BIT_H + 16} textAnchor="middle" fill={r.seg.color} fontSize={9} fontFamily="monospace">{r.seg.label}</text>)}</g>))}
        </svg>
      </div>
      {tooltip && (<div className="waveform-tooltip" style={{ position: 'fixed', left: tooltip.x, top: tooltip.y - 30, pointerEvents: 'none' }}>{tooltip.text}</div>)}
      <div className="segment-legend">{segments.map((seg, i) => (<div key={i} className="seg-item"><span className="seg-dot" style={{ backgroundColor: seg.color }} /><span>{seg.label}: {seg.description.split('(')[0].trim()}</span></div>))}</div>
    </div>
  );
}
