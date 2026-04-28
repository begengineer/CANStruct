import { useEffect, useRef, useState } from 'react';
import type { CANFrame } from '../engine/types';
import { simulator } from '../engine/CANSimulator';

export function BusMonitor(_props: { paused: boolean }) {
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: string, payload: unknown) => {
      if (event === 'frame') {
        setFrames(prev => { const next = [...prev, payload as CANFrame]; return next.length > 500 ? next.slice(-500) : next; });
      }
    };
    simulator.on(listener as never);
    return () => simulator.off(listener as never);
  }, []);

  useEffect(() => { if (autoScroll && tableRef.current) tableRef.current.scrollTop = tableRef.current.scrollHeight; }, [frames, autoScroll]);

  const filtered = frames.filter(f => {
    if (!filter) return true;
    const hex = f.canId.toString(16).toUpperCase().padStart(3, '0');
    return hex.includes(filter.toUpperCase()) || f.messageName.toLowerCase().includes(filter.toLowerCase()) || f.nodeName.toLowerCase().includes(filter.toLowerCase());
  });

  const dataHex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  const canIdStr = (f: CANFrame) => (f.isExtended ? '0x' : '') + f.canId.toString(16).toUpperCase().padStart(f.isExtended ? 8 : 3, '0') + 'h';

  return (
    <div className="bus-monitor">
      <div className="monitor-header">
        <h2>Bus Monitor</h2>
        <div className="monitor-controls">
          <input type="text" placeholder="Filter (ID / Name / Node)" value={filter} onChange={e => setFilter(e.target.value)} className="filter-input" />
          <label className="autoscroll-label"><input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />Auto scroll</label>
          <span className="frame-count">{filtered.length} frames</span>
        </div>
      </div>
      <div className="table-wrapper" ref={tableRef}>
        <table className="frame-table">
          <thead><tr><th>Time (ms)</th><th>CAN ID</th><th>Message</th><th>Node</th><th>DLC</th><th>Data (HEX)</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className={f.isError ? 'row-error' : ''}>
                <td className="mono">{f.timestamp.toFixed(0)}</td>
                <td className="mono">{canIdStr(f)}</td>
                <td>{f.messageName}</td>
                <td><span className="node-badge" style={{ backgroundColor: f.nodeColor }}>{f.nodeName}</span></td>
                <td className="mono">{f.dlc}</td>
                <td className="mono data-cell">{dataHex(f.data)}</td>
                <td>{f.isError ? <span className="badge-error">{f.errorType} ERROR</span> : <span className="badge-ok">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
