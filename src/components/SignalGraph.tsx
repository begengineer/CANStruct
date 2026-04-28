import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { simulator } from '../engine/CANSimulator';
import type { DecodedSignal } from '../engine/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
interface SignalPoint { time: number; [key: string]: number; }
interface SelectedSignal { signalId: string; signalName: string; messageName: string; unit: string; color: string; }

export function SignalGraph() {
  const [selected, setSelected] = useState<SelectedSignal[]>([]);
  const [data, setData] = useState<SignalPoint[]>([]);
  const [windowMs, setWindowMs] = useState(5000);

  const allSignals = simulator.messages.flatMap(m => m.signals.map(s => ({ signalId: s.id, signalName: s.name, messageName: m.name, unit: s.unit })));

  useEffect(() => {
    const listener = (event: string, payload: unknown) => {
      if (event !== 'signal') return;
      const signals = payload as DecodedSignal[];
      const relevantIds = new Set(selected.map(s => s.signalId));
      const relevant = signals.filter(s => relevantIds.has(s.signalId));
      if (relevant.length === 0) return;
      setData(prev => {
        const t = relevant[0].timestamp;
        const newPoint: SignalPoint = { time: t };
        relevant.forEach(s => { newPoint[s.signalId] = s.physicalValue; });
        return [...prev, newPoint].filter(p => p.time >= t - windowMs);
      });
    };
    simulator.on(listener as never);
    return () => simulator.off(listener as never);
  }, [selected, windowMs]);

  const toggleSignal = useCallback((sig: typeof allSignals[number]) => {
    setSelected(prev => {
      const exists = prev.find(s => s.signalId === sig.signalId);
      if (exists) return prev.filter(s => s.signalId !== sig.signalId);
      if (prev.length >= COLORS.length) return prev;
      return [...prev, { ...sig, color: COLORS[prev.length] }];
    });
  }, []);

  const formatTime = (t: number) => `${(t / 1000).toFixed(1)}s`;

  return (
    <div className="signal-graph">
      <div className="graph-header">
        <h2>Signal Graph</h2>
        <div className="graph-controls"><label>Window:<select value={windowMs} onChange={e => setWindowMs(Number(e.target.value))} className="window-select"><option value={2000}>2s</option><option value={5000}>5s</option><option value={10000}>10s</option><option value={30000}>30s</option></select></label></div>
      </div>
      <div className="signal-selector">
        <p className="selector-label">Select signals (max 6):</p>
        <div className="signal-chips">
          {allSignals.map(sig => { const sel = selected.find(s => s.signalId === sig.signalId); return (<button key={sig.signalId} className={`signal-chip ${sel ? 'active' : ''}`} style={sel ? { borderColor: sel.color, color: sel.color } : {}} onClick={() => toggleSignal(sig)}>{sig.messageName}.{sig.signalName}{sig.unit ? ` (${sig.unit})` : ''}</button>); })}
        </div>
      </div>
      {selected.length === 0 ? (
        <div className="empty-graph"><p>上のボタンでシグナルを選択してください</p></div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: unknown, name: unknown) => { const v = Number(value); const n = String(name); const sig = selected.find(s => s.signalId === n); return [`${v.toFixed(2)} ${sig?.unit ?? ''}`, sig?.signalName ?? n]; }} labelFormatter={t => `T: ${formatTime(Number(t))}`} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Legend formatter={(value: string) => { const sig = selected.find(s => s.signalId === value); return sig ? `${sig.messageName}.${sig.signalName}` : value; }} />
              {selected.map(sig => (<Line key={sig.signalId} type="monotone" dataKey={sig.signalId} stroke={sig.color} dot={false} isAnimationActive={false} strokeWidth={2} />))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
