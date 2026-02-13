import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import GSNodeComponent from './components/GSNodeComponent';
import { parseGsrc } from './parser/gsrc-parser';
import { gsrcToFlow, type NodeData } from './utils/gsrc-to-flow';
import type { GSrcFile } from './types/graphscript';

const nodeTypes = { gsNode: GSNodeComponent as any };

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { strokeWidth: 2 },
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [gsrcFile, setGsrcFile] = useState<GSrcFile | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', style: { stroke: '#E85D3A', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const handleFileLoad = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseGsrc(buffer);
      setGsrcFile(parsed);
      setFileName(file.name);

      const { nodes: flowNodes, edges: flowEdges } = gsrcToFlow(parsed);
      setNodes(flowNodes);
      setEdges(flowEdges);
      setStats({ nodes: flowNodes.length, edges: flowEdges.length });
    } catch (err) {
      console.error('Failed to parse .gsrc file:', err);
      alert(`Failed to parse file: ${(err as Error).message}`);
    }
  }, [setNodes, setEdges]);

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    const term = searchTerm.toLowerCase();
    return nodes.map(n => ({
      ...n,
      hidden: !(n.data as NodeData).className.toLowerCase().includes(term),
    }));
  }, [nodes, searchTerm]);

  const handleFitView = useCallback(() => {
    // Will be handled by fitView on ReactFlow
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0A0A0A',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <ReactFlow
        nodes={searchTerm ? filteredNodes : nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0A0A0A' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1A1A1A"
        />
        <Controls
          style={{
            background: '#1A1A1A',
            border: '1px solid #333',
            borderRadius: 6,
          }}
        />

        {/* Top toolbar */}
        <Panel position="top-left">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            background: 'linear-gradient(180deg, #151515 0%, #0D0D0D 100%)',
            border: '1px solid #2A2A2A',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            {/* Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #E85D3A, #FF8C42)',
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 900,
                color: '#000',
              }}>⬡</div>
              <div>
                <div style={{ color: '#E85D3A', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                  GSRC Editor
                </div>
                <div style={{ color: '#555', fontSize: 9, lineHeight: 1 }}>
                  Mad Max GraphScript
                </div>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: '#333' }} />

            {/* File controls */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".gsrc,.bin"
              onChange={handleFileLoad}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#E85D3A',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FF7A50')}
              onMouseLeave={e => (e.currentTarget.style.background = '#E85D3A')}
            >
              📂 Open .gsrc
            </button>

            {fileName && (
              <>
                <div style={{ color: '#888', fontSize: 11 }}>
                  <span style={{ color: '#DCDCAA' }}>{fileName}</span>
                  <span style={{ color: '#555', marginLeft: 8 }}>
                    {stats.nodes} nodes · {stats.edges} edges
                  </span>
                </div>

                <div style={{ width: 1, height: 28, background: '#333' }} />

                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '5px 10px 5px 26px',
                      color: '#E0E0E0',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      width: 160,
                      outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#E85D3A')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#333')}
                  />
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#555' }}>🔍</span>
                </div>
              </>
            )}
          </div>
        </Panel>

        {/* Welcome panel when no file loaded */}
        {!fileName && (
          <Panel position="top-center">
            <div style={{
              marginTop: '30vh',
              textAlign: 'center',
              color: '#444',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E85D3A', marginBottom: 8 }}>
                Mad Max GSRC Node Editor
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 24 }}>
                Open a .gsrc file to visualize and edit GraphScript node graphs
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'linear-gradient(135deg, #E85D3A, #FF8C42)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 28px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                📂 Open .gsrc File
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
