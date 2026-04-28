import { useState } from 'react';
import { Play, Square, RotateCcw, Send, AlertTriangle } from 'lucide-react';
import { simulator } from '../engine/CANSimulator';
import type { CANFrame } from '../engine/types';

interface Props { running: boolean; timeMs: number; onStart: () => void; onStop: () => void; onReset: () => void; onSelectFrame: (frame: CANFrame) => void; }
const ERROR_TYPES: CANFrame['errorType'][] = ['BIT', 'STUFF', 'CRC', 'FORM', 'ACK'];

export function ControlPanel({ running, timeMs, onStart, onStop, onReset }: Props) {
  const [manualId, setManualId] = useState('0x100');
  const [manualData, setManualData] = useState('DE AD BE EF 00 00 00 00');
  const [manualNodeId, setManualNodeId] = useState(simulator.nodes[0]?.id ?? '');
  const [errorRate, setErrorRate] = useState(0.5);
  const [sendMsg, setSendMsg] = useState('');

  const handleManualSend = () => {
    try {
      const id = parseInt(manualId, 16);
      if (isNaN(id) || id < 0 || id > 0x7ff) { setSendMsg('Invalid ID (0x000 – 0x7FF)'); return; }
      const bytes = manualData.replace(/\s+/g, '').match(/.{1,2}/g)?.map(h => parseInt(h, 16)) ?? [];
      if (bytes.some(isNaN) || bytes.length === 0 || bytes.length > 8) { setSendMsg('Invalid data (1-8 hex bytes)'); return; }
      simulator.sendFrame(id, false, new Uint8Array(bytes), manualNodeId || simulator.nodes[0]?.id);
      setSendMsg(`Sent 0x${id.toString(16).toUpperCase().padStart(3, '0')}`);
      setTimeout(() => setSendMsg(''), 2000);
    } catch { setSendMsg('Error sending frame'); }
  };

  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`; };

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h3>Simulation</h3>
        <div className="sim-status">
          <span className={`status-dot ${running ? 'running' : 'stopped'}`} />
          <span className="status-label">{running ? 'Running' : 'Stopped'}</span>
          <span className="sim-time mono">{formatTime(timeMs)}</span>
        </div>
        <div className="btn-row">
          <button className={`btn-primary ${running ? 'disabled' : ''}`} onClick={onStart} disabled={running}><Play size={14} /> Start</button>
          <button className={`btn-danger ${!running ? 'disabled' : ''}`} onClick={onStop} disabled={!running}><Square size={14} /> Stop</button>
          <button className="btn-secondary" onClick={onReset}><RotateCcw size={14} /> Reset</button>
        </div>
        <div className="error-rate-row"><label>Error Rate: {errorRate.toFixed(1)}%<input type="range" min={0} max={20} step={0.1} value={errorRate} onChange={e => { setErrorRate(Number(e.target.value)); simulator.setErrorRate(Number(e.target.value) / 100); }} className="slider" /></label></div>
      </div>
      <div className="panel-section">
        <h3>Error Injection</h3>
        <div className="error-btns">{ERROR_TYPES.map(type => (<button key={type} className="btn-error" onClick={() => simulator.injectError(type)}><AlertTriangle size={11} />{type}</button>))}</div>
      </div>
      <div className="panel-section">
        <h3>Manual Send</h3>
        <div className="manual-form">
          <label className="form-label">CAN ID (hex)<input className="text-input" value={manualId} onChange={e => setManualId(e.target.value)} placeholder="0x100" /></label>
          <label className="form-label">Data bytes (hex)<input className="text-input" value={manualData} onChange={e => setManualData(e.target.value)} placeholder="DE AD BE EF" /></label>
          <label className="form-label">Sender Node<select className="select-input" value={manualNodeId} onChange={e => setManualNodeId(e.target.value)}>{simulator.nodes.map(n => (<option key={n.id} value={n.id}>{n.name}</option>))}</select></label>
          <button className="btn-primary" onClick={handleManualSend}><Send size={14} /> Send Frame</button>
          {sendMsg && <span className="send-msg">{sendMsg}</span>}
        </div>
      </div>
      <div className="panel-section">
        <h3>Statistics</h3>
        <div className="stats">
          <div className="stat-row"><span>Total frames:</span><span className="mono">{simulator.getFrames().length}</span></div>
          <div className="stat-row"><span>Error frames:</span><span className="mono error-text">{simulator.getFrames().filter(f => f.isError).length}</span></div>
          {simulator.nodes.map(n => (<div key={n.name} className="stat-row"><span><span className="node-dot-sm" style={{ backgroundColor: n.color }} />{n.name}:</span><span className="mono">{simulator.getFrames().filter(f => f.nodeId === n.id && !f.isError).length}</span></div>))}
        </div>
      </div>
    </div>
  );
}
