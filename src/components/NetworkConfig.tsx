import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { simulator } from '../engine/CANSimulator';
import type { CANNodeDef, CANMessageDef, CANSignalDef } from '../engine/types';

interface Props { onUpdate: () => void; }

export function NetworkConfig({ onUpdate }: Props) {
  const [nodes, setNodes] = useState<CANNodeDef[]>(simulator.nodes);
  const [messages, setMessages] = useState<CANMessageDef[]>(simulator.messages);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newNodeName, setNewNodeName] = useState('');

  const refresh = () => { setNodes([...simulator.nodes]); setMessages([...simulator.messages]); onUpdate(); };
  const toggleExpand = (id: string) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const addNode = () => { if (!newNodeName.trim()) return; simulator.addNode(newNodeName.trim()); setNewNodeName(''); refresh(); };
  const removeNode = (id: string) => { simulator.removeNode(id); refresh(); };
  const toggleNode = (id: string) => { const node = simulator.nodes.find(n => n.id === id); if (node) simulator.updateNode(id, { active: !node.active }); refresh(); };
  const addMessage = (nodeId: string) => { simulator.addMessage({ canId: Math.floor(Math.random() * 0x7ff), isExtended: false, name: 'NEW_MSG', dlc: 8, cycleMs: 100, nodeId, signals: [] }); refresh(); };
  const removeMessage = (id: string) => { simulator.removeMessage(id); refresh(); };
  const updateMessage = (id: string, field: string, value: string | number | boolean) => { simulator.updateMessage(id, { [field]: value } as never); refresh(); };
  const addSignal = (msgId: string) => { simulator.addSignal(msgId, { name: 'NewSignal', startBit: 0, length: 8, factor: 1, offset: 0, min: 0, max: 255, unit: '', bitOrder: 'little_endian', valueType: 'unsigned' }); refresh(); };
  const removeSignal = (msgId: string, sigId: string) => { simulator.removeSignal(msgId, sigId); refresh(); };

  return (
    <div className="network-config">
      <h2>Network Configuration</h2>
      <div className="add-row">
        <input type="text" placeholder="New node name" value={newNodeName} onChange={e => setNewNodeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNode()} className="text-input" />
        <button className="btn-primary" onClick={addNode}><Plus size={14} /> Add Node</button>
      </div>
      {nodes.map(node => {
        const nodeMessages = messages.filter(m => m.nodeId === node.id);
        const isExp = expanded.has(node.id);
        return (
          <div key={node.id} className="node-card">
            <div className="node-header">
              <button className="expand-btn" onClick={() => toggleExpand(node.id)}>{isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
              <span className="node-dot" style={{ backgroundColor: node.color }} />
              <span className="node-name">{node.name}</span>
              <label className="toggle-label"><input type="checkbox" checked={node.active} onChange={() => toggleNode(node.id)} />Active</label>
              <button className="btn-icon" onClick={() => removeNode(node.id)}><Trash2 size={14} /></button>
            </div>
            {isExp && (
              <div className="message-list">
                {nodeMessages.map(msg => (
                  <div key={msg.id} className="message-row">
                    <div className="msg-header">
                      <input className="msg-name-input" value={msg.name} onChange={e => updateMessage(msg.id, 'name', e.target.value)} />
                      <span className="msg-id">ID:<input className="hex-input" value={`0x${msg.canId.toString(16).toUpperCase()}`} onChange={e => { const v = parseInt(e.target.value, 16); if (!isNaN(v)) updateMessage(msg.id, 'canId', v); }} /></span>
                      <span className="msg-cycle">Cycle:<input type="number" className="num-input" value={msg.cycleMs} min={0} onChange={e => updateMessage(msg.id, 'cycleMs', Number(e.target.value))} />ms</span>
                      <span className="msg-dlc">DLC:<input type="number" className="num-input" value={msg.dlc} min={0} max={8} onChange={e => updateMessage(msg.id, 'dlc', Number(e.target.value))} /></span>
                      <button className="btn-icon" onClick={() => removeMessage(msg.id)}><Trash2 size={12} /></button>
                    </div>
                    <div className="signal-list">
                      {msg.signals.map((sig: CANSignalDef) => (
                        <div key={sig.id} className="signal-row">
                          <span className="sig-name">{sig.name}</span>
                          <span className="sig-detail">bit[{sig.startBit}:{sig.startBit + sig.length - 1}] × {sig.factor} + {sig.offset}{sig.unit && ` ${sig.unit}`}<span className="sig-range"> [{sig.min}, {sig.max}]</span></span>
                          <button className="btn-icon" onClick={() => removeSignal(msg.id, sig.id)}><Trash2 size={10} /></button>
                        </div>
                      ))}
                      <button className="btn-secondary btn-xs" onClick={() => addSignal(msg.id)}><Plus size={10} /> Add Signal</button>
                    </div>
                  </div>
                ))}
                <button className="btn-secondary btn-sm" onClick={() => addMessage(node.id)}><Plus size={12} /> Add Message</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
