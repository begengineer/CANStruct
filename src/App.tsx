import { useState, useEffect, useCallback } from 'react';
import { simulator } from './engine/CANSimulator';
import { BusMonitor } from './components/BusMonitor';
import { SignalGraph } from './components/SignalGraph';
import { FrameWaveform } from './components/FrameWaveform';
import { NetworkConfig } from './components/NetworkConfig';
import { ControlPanel } from './components/ControlPanel';
import { BusTimeline } from './components/BusTimeline';
import { NetworkTopology } from './components/NetworkTopology';
import type { CANFrame } from './engine/types';
import './App.css';

type Tab = 'monitor' | 'graph' | 'waveform' | 'topology' | 'config';

export default function App() {
  const [running, setRunning] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('monitor');
  const [selectedFrame, setSelectedFrame] = useState<CANFrame | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = (event: string, payload: unknown) => {
      if (event === 'tick') setTimeMs(payload as number);
    };
    simulator.on(listener as never);
    return () => simulator.off(listener as never);
  }, []);

  const handleStart = useCallback(() => { simulator.start(); setRunning(true); }, []);
  const handleStop = useCallback(() => { simulator.stop(); setRunning(false); }, []);
  const handleReset = useCallback(() => { simulator.reset(); setRunning(false); setTimeMs(0); setSelectedFrame(null); }, []);
  const handleSelectFrame = useCallback((frame: CANFrame) => { setSelectedFrame(frame); setActiveTab('waveform'); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'monitor', label: 'Bus Monitor' },
    { id: 'graph', label: 'Signal Graph' },
    { id: 'waveform', label: 'Frame Waveform' },
    { id: 'topology', label: 'Network Topology' },
    { id: 'config', label: 'Network Config' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title"><span className="title-icon">⚡</span>CANStruct</h1>
          <span className="app-subtitle">CAN Bus Simulator &amp; Visualizer</span>
        </div>
        <div className="header-right">
          <span className={`running-badge ${running ? 'active' : ''}`}>{running ? '● RUNNING' : '■ STOPPED'}</span>
          <span className="header-time mono">{(timeMs / 1000).toFixed(3)}s</span>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <ControlPanel running={running} timeMs={timeMs} onStart={handleStart} onStop={handleStop} onReset={handleReset} onSelectFrame={handleSelectFrame} />
        </aside>
        <main className="main-content">
          <BusTimeline onSelectFrame={handleSelectFrame} />
          <div className="tab-panel">
            <div className="tab-bar">
              {tabs.map(t => (
                <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <div className="tab-content">
              {activeTab === 'monitor' && <BusMonitor paused={!running} />}
              {activeTab === 'graph' && <SignalGraph />}
              {activeTab === 'waveform' && <FrameWaveform frame={selectedFrame} />}
              {activeTab === 'topology' && <NetworkTopology />}
              {activeTab === 'config' && <NetworkConfig onUpdate={() => forceUpdate(n => n + 1)} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
