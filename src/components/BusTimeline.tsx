import { useEffect, useRef, useState } from 'react';
import type { CANFrame } from '../engine/types';
import { simulator } from '../engine/CANSimulator';

interface Props { onSelectFrame: (frame: CANFrame) => void; }
const TRACK_H = 22;
const FRAME_W = 6;
const TIMELINE_H_PER_NODE = TRACK_H + 4;

export function BusTimeline(_props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [windowMs, setWindowMs] = useState(2000);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const nodes = simulator.nodes;
      const frames = simulator.getFrames();
      const now = simulator.getTimeMs();
      const startT = now - windowMs;
      const W = canvas.width; const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, W, H);
      const nodeIdxMap = new Map(nodes.map((n, i) => [n.id, i]));
      const LABEL_W = 120;
      const chartW = W - LABEL_W;
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { const x = LABEL_W + (chartW * i) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.fillStyle = '#4b5563'; ctx.font = '10px monospace';
      for (let i = 0; i <= 10; i++) { const t = startT + (windowMs * i) / 10; const x = LABEL_W + (chartW * i) / 10; ctx.fillText(`${(t / 1000).toFixed(2)}s`, x + 2, H - 4); }
      nodes.forEach((node, ni) => {
        const y = ni * TIMELINE_H_PER_NODE;
        ctx.fillStyle = '#1f2937'; ctx.fillRect(0, y, LABEL_W - 2, TRACK_H);
        ctx.fillStyle = node.color; ctx.beginPath(); ctx.arc(8, y + TRACK_H / 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e5e7eb'; ctx.font = '11px sans-serif'; ctx.fillText(node.name, 18, y + TRACK_H / 2 + 4);
        ctx.strokeStyle = '#374151'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LABEL_W, y + TRACK_H / 2); ctx.lineTo(W, y + TRACK_H / 2); ctx.stroke();
      });
      frames.filter(f => f.timestamp >= startT && f.timestamp <= now).forEach(frame => {
        const ni = nodeIdxMap.get(frame.nodeId);
        if (ni === undefined) return;
        const x = LABEL_W + ((frame.timestamp - startT) / windowMs) * chartW;
        const y = ni * TIMELINE_H_PER_NODE;
        if (frame.isError) {
          ctx.fillStyle = '#ef4444'; ctx.fillRect(x - 2, y + 2, 4, TRACK_H - 4);
          ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y + TRACK_H - 2); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x - 3, y + TRACK_H - 2); ctx.stroke();
        } else {
          ctx.fillStyle = frame.nodeColor; ctx.globalAlpha = 0.85; ctx.fillRect(x, y + 3, FRAME_W, TRACK_H - 6); ctx.globalAlpha = 1;
        }
      });
    };
    let animId: number;
    const loop = () => { draw(); animId = requestAnimationFrame(loop); };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [windowMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = Math.max(simulator.nodes.length * TIMELINE_H_PER_NODE + 20, 80); };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="bus-timeline">
      <div className="timeline-header">
        <h2>Bus Timeline</h2>
        <label>Window:<select value={windowMs} onChange={e => setWindowMs(Number(e.target.value))} className="window-select"><option value={500}>0.5s</option><option value={1000}>1s</option><option value={2000}>2s</option><option value={5000}>5s</option></select></label>
      </div>
      <canvas ref={canvasRef} className="timeline-canvas" style={{ width: '100%', display: 'block', cursor: 'crosshair' }} />
      <div className="timeline-legend">
        <span className="legend-item"><span className="legend-bar" style={{ backgroundColor: '#3b82f6' }} /> Data frame</span>
        <span className="legend-item"><span className="legend-bar" style={{ backgroundColor: '#ef4444' }} /> Error frame</span>
      </div>
    </div>
  );
}
