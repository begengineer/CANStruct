import { useEffect, useRef, useCallback } from 'react';
import { simulator } from '../engine/CANSimulator';
import type { CANFrame } from '../engine/types';

interface Packet { id: string; senderX: number; color: string; startTime: number; messageName: string; canId: number; isError: boolean; }
interface NodeActivity { lastTxTime: number; frameCount: number; lastMessage: string; }

const PACKET_DURATION = 700;
const NODE_W = 110;
const NODE_H = 56;
const STUB_H = 52;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | { tl: number; tr: number; bl: number; br: number }) {
  const rad = typeof r === 'number' ? { tl: r, tr: r, bl: r, br: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y); ctx.lineTo(x + w - rad.tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br); ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl); ctx.quadraticCurveTo(x, y, x + rad.tl, y); ctx.closePath();
}

function drawTerminator(ctx: CanvasRenderingContext2D, x: number, busY: number) {
  const W = 6; const H = 18;
  ctx.fillStyle = '#334155'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
  ctx.fillRect(x - W / 2, busY - H / 2, W, H); ctx.strokeRect(x - W / 2, busY - H / 2, W, H);
  ctx.fillStyle = '#94a3b8'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('120Ω', x, busY + H / 2 + 10);
}

export function NetworkTopology() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetsRef = useRef<Packet[]>([]);
  const activityRef = useRef<Map<string, NodeActivity>>(new Map());
  const rafRef = useRef<number>(0);

  const getLayout = useCallback((W: number, busY: number) => {
    const nodes = simulator.nodes;
    const busLeft = 50; const busRight = W - 50;
    const count = nodes.length;
    const spacing = count > 1 ? (busRight - busLeft) / (count - 1) : 0;
    return {
      busLeft, busRight,
      nodes: nodes.map((node, i) => {
        const x = count === 1 ? W / 2 : busLeft + i * spacing;
        const isAbove = i % 2 === 0;
        const stubEnd = isAbove ? busY - STUB_H : busY + STUB_H;
        const nodeY = isAbove ? stubEnd - NODE_H / 2 : stubEnd + NODE_H / 2;
        return { node, x, nodeY, isAbove, stubEnd };
      }),
    };
  }, []);

  useEffect(() => {
    const listener = (event: string, payload: unknown) => {
      if (event !== 'frame') return;
      const frame = payload as CANFrame;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const busY = canvas.height * 0.55;
      const { nodes } = getLayout(canvas.width, busY);
      const sender = nodes.find(p => p.node.id === frame.nodeId);
      const senderX = sender?.x ?? canvas.width / 2;
      const now = performance.now();
      packetsRef.current.push({ id: frame.id, senderX, color: frame.isError ? '#ef4444' : frame.nodeColor, startTime: now, messageName: frame.messageName, canId: frame.canId, isError: frame.isError });
      const activity = activityRef.current.get(frame.nodeId) ?? { lastTxTime: 0, frameCount: 0, lastMessage: '' };
      activity.lastTxTime = now; activity.frameCount++; activity.lastMessage = frame.messageName;
      activityRef.current.set(frame.nodeId, activity);
    };
    simulator.on(listener as never);
    return () => simulator.off(listener as never);
  }, [getLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width; const H = canvas.height; const now = performance.now();
      const busY = H * 0.55;
      const { busLeft, busRight, nodes } = getLayout(W, busY);
      packetsRef.current = packetsRef.current.filter(p => now - p.startTime < PACKET_DURATION + 200);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1e293b';
      for (let gx = 20; gx < W; gx += 40) for (let gy = 20; gy < H; gy += 40) { ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill(); }
      packetsRef.current.forEach(packet => {
        const elapsed = now - packet.startTime;
        const progress = Math.min(elapsed / PACKET_DURATION, 1);
        const alpha = Math.max(0, 1 - progress * 1.3);
        if (alpha <= 0) return;
        const traveled = progress * (busRight - busLeft + 40);
        const leftX = Math.max(busLeft - 2, packet.senderX - traveled);
        const rightX = Math.min(busRight + 2, packet.senderX + traveled);
        ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = packet.color; ctx.shadowBlur = 12; ctx.strokeStyle = packet.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(leftX, busY); ctx.lineTo(rightX, busY); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = packet.color; ctx.shadowBlur = 16;
        if (leftX > busLeft) { ctx.beginPath(); ctx.arc(leftX, busY, 5, 0, Math.PI * 2); ctx.fillStyle = packet.color; ctx.fill(); }
        if (rightX < busRight) { ctx.beginPath(); ctx.arc(rightX, busY, 5, 0, Math.PI * 2); ctx.fillStyle = packet.color; ctx.fill(); }
        ctx.restore();
      });
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 4; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(busLeft, busY); ctx.lineTo(busRight, busY); ctx.stroke();
      drawTerminator(ctx, busLeft, busY); drawTerminator(ctx, busRight, busY);
      ctx.fillStyle = '#475569'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('CAN BUS', busLeft + 14, busY - 8);
      nodes.forEach(({ node, x, nodeY, stubEnd }) => {
        const act = activityRef.current.get(node.id);
        const timeSinceTx = act ? now - act.lastTxTime : Infinity;
        const glowAlpha = Math.max(0, 1 - timeSinceTx / 250);
        const isActive = glowAlpha > 0;
        ctx.save();
        if (isActive) { ctx.shadowColor = node.color; ctx.shadowBlur = 14 * glowAlpha; ctx.strokeStyle = node.color; ctx.lineWidth = 2.5; }
        else { ctx.strokeStyle = '#2d3f55'; ctx.lineWidth = 2; }
        ctx.beginPath(); ctx.moveTo(x, busY); ctx.lineTo(x, stubEnd); ctx.stroke(); ctx.restore();
        ctx.save();
        if (isActive) { ctx.shadowColor = node.color; ctx.shadowBlur = 12 * glowAlpha; }
        ctx.beginPath(); ctx.arc(x, busY, 5, 0, Math.PI * 2); ctx.fillStyle = isActive ? node.color : '#475569'; ctx.fill(); ctx.restore();
        const boxX = x - NODE_W / 2; const boxY = nodeY - NODE_H / 2;
        if (isActive) { ctx.save(); ctx.shadowColor = node.color; ctx.shadowBlur = 24 * glowAlpha; ctx.globalAlpha = glowAlpha * 0.6; roundRect(ctx, boxX - 2, boxY - 2, NODE_W + 4, NODE_H + 4, 8); ctx.strokeStyle = node.color; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
        ctx.save(); roundRect(ctx, boxX, boxY, NODE_W, NODE_H, 6); ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.strokeStyle = isActive ? node.color : '#334155'; ctx.lineWidth = isActive ? 1.5 : 1; ctx.stroke(); ctx.restore();
        ctx.save(); roundRect(ctx, boxX, boxY, NODE_W, 8, { tl: 6, tr: 6, bl: 0, br: 0 }); ctx.fillStyle = node.color; ctx.globalAlpha = node.active ? 1 : 0.35; ctx.fill(); ctx.restore();
        ctx.fillStyle = node.active ? '#f1f5f9' : '#64748b'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(node.name, x, boxY + 22);
        ctx.fillStyle = '#64748b'; ctx.font = '9px monospace'; ctx.fillText(`${act?.frameCount ?? 0} frames`, x, boxY + 36);
        if (isActive) { ctx.save(); ctx.globalAlpha = glowAlpha; ctx.fillStyle = node.color; ctx.font = 'bold 9px system-ui'; ctx.fillText('▶ TX', x, boxY + 49); ctx.restore(); }
        else if (!node.active) { ctx.fillStyle = '#475569'; ctx.font = '9px system-ui'; ctx.fillText('INACTIVE', x, boxY + 49); }
        ctx.textAlign = 'left';
      });
      packetsRef.current.forEach(packet => {
        const elapsed = now - packet.startTime;
        if (elapsed > 500) return;
        const labelAlpha = Math.max(0, 1 - elapsed / 500);
        const floatY = busY - 24 - elapsed * 0.04;
        ctx.save(); ctx.globalAlpha = labelAlpha; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        const label = packet.isError ? '⚠ ERROR FRAME' : `0x${packet.canId.toString(16).toUpperCase().padStart(3, '0')}  ${packet.messageName}`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(15,23,42,0.85)'; ctx.fillRect(packet.senderX - tw / 2 - 4, floatY - 11, tw + 8, 14);
        ctx.fillStyle = packet.isError ? '#fca5a5' : '#e2e8f0'; ctx.fillText(label, packet.senderX, floatY);
        ctx.textAlign = 'left'; ctx.restore();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [getLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => { canvas.width = canvas.offsetWidth; canvas.height = 220; });
    canvas.width = canvas.offsetWidth || 800; canvas.height = 220;
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="network-topology">
      <div className="topology-header">
        <h2>Network Topology</h2>
        <span className="topology-subtitle">リアルタイム CAN 通信フロー</span>
      </div>
      <canvas ref={canvasRef} className="topology-canvas" style={{ width: '100%', display: 'block' }} />
    </div>
  );
}
