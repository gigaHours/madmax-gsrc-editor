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
  useReactFlow,
  ReactFlowProvider,
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

const defaultEdgeOptionsBase = {
  style: { strokeWidth: 2 },
};

interface SelectedEdgeInfo {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  isVariable: boolean;
}

function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [gsrcFile, setGsrcFile] = useState<GSrcFile | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [edgeType, setEdgeType] = useState<'smoothstep' | 'bezier'>('smoothstep');
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdgeInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchListRef = useRef<HTMLDivElement>(null);
  const { setCenter, getNode } = useReactFlow();

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', style: { stroke: '#E85D3A', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const navigateToNode = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const x = node.position.x + (node.measured?.width ?? 160) / 2;
    const y = node.position.y + (node.measured?.height ?? 80) / 2;
    setCenter(x, y, { zoom: 1.2, duration: 400 });
  }, [getNode, setCenter]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) return [];
    const term = searchTerm.toLowerCase();
    return nodes
      .filter(n => {
        const d = n.data as NodeData;
        const className = d.className.toLowerCase();
        const nodeIndex = `#${d.nodeIndex}`;
        // Search in class name, node index, and parameter values
        if (className.includes(term) || nodeIndex.includes(term)) return true;
        return d.parameters.some(p =>
          (p._resolvedName?.toLowerCase().includes(term)) ||
          (p._displayValue?.toLowerCase().includes(term))
        );
      })
      .slice(0, 20) // limit dropdown
      .map(n => {
        const d = n.data as NodeData;
        return { id: n.id, className: d.className, nodeIndex: d.nodeIndex, category: d.category };
      });
  }, [nodes, searchTerm]);

  const handleSearchNav = useCallback((nodeId: string) => {
    navigateToNode(nodeId);
    setSearchOpen(false);
    setSearchHighlight(-1);
  }, [navigateToNode]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchHighlight(h => {
        const next = Math.min(h + 1, searchResults.length - 1);
        // Scroll into view
        searchListRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchHighlight(h => {
        const next = Math.max(h - 1, 0);
        searchListRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter' && searchHighlight >= 0 && searchHighlight < searchResults.length) {
      e.preventDefault();
      handleSearchNav(searchResults[searchHighlight].id);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchHighlight(-1);
      searchInputRef.current?.blur();
    }
  }, [searchResults, searchHighlight, handleSearchNav]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const sourceNode = getNode(edge.source);
    const targetNode = getNode(edge.target);
    const sourceLabel = (sourceNode?.data as NodeData)?.className ?? edge.source;
    const targetLabel = (targetNode?.data as NodeData)?.className ?? edge.target;
    const isVariable = edge.style?.stroke === '#4EC9B0';

    setSelectedEdge({
      edgeId: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      sourceLabel,
      targetLabel,
      isVariable,
    });
  }, [getNode]);

  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, []);

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

  const styledEdges = useMemo(() => {
    return edges.map(e => {
      const isSelected = selectedEdge?.edgeId === e.id;
      const isRelated = selectedEdge && (e.source === selectedEdge.sourceId || e.target === selectedEdge.targetId);
      const dimmed = selectedEdge && !isSelected && !isRelated;
      return {
        ...e,
        type: edgeType,
        animated: isSelected,
        style: {
          ...e.style,
          strokeWidth: isSelected ? 4 : (e.style?.strokeWidth ?? 2),
          stroke: isSelected
            ? '#FFD700'
            : dimmed
              ? `${e.style?.stroke ?? '#555'}44`
              : e.style?.stroke,
          opacity: dimmed ? 0.3 : 1,
        },
        zIndex: isSelected ? 1000 : undefined,
      };
    });
  }, [edges, edgeType, selectedEdge]);

  // no-op removed: filteredNodes / handleFitView

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0A0A0A',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ ...defaultEdgeOptionsBase, type: edgeType }}
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

                {/* Search with dropdown results */}
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search nodes..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setSearchOpen(true);
                      setSearchHighlight(-1);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => { setTimeout(() => setSearchOpen(false), 200); }}
                    onKeyDown={handleSearchKeyDown}
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '5px 10px 5px 26px',
                      color: '#E0E0E0',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      width: 200,
                      outline: 'none',
                    }}
                  />
                  <span style={{ position: 'absolute', left: 8, top: 11, fontSize: 12, color: '#555' }}>🔍</span>
                  {searchTerm && searchOpen && (
                    <div
                      ref={searchListRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: '#151515',
                        border: '1px solid #333',
                        borderRadius: 6,
                        maxHeight: 320,
                        overflowY: 'auto',
                        zIndex: 9999,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                        minWidth: 280,
                      }}
                    >
                      {searchResults.length === 0 ? (
                        <div style={{ padding: '10px 12px', color: '#555', fontSize: 10 }}>
                          No nodes found
                        </div>
                      ) : (
                        <>
                          <div style={{ padding: '6px 12px', color: '#555', fontSize: 9, borderBottom: '1px solid #222' }}>
                            {searchResults.length} result{searchResults.length > 1 ? 's' : ''} {searchResults.length === 20 ? '(max)' : ''}
                          </div>
                          {searchResults.map((r, i) => (
                            <div
                              key={r.id}
                              onMouseDown={(e) => { e.preventDefault(); handleSearchNav(r.id); }}
                              onMouseEnter={() => setSearchHighlight(i)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 12px',
                                cursor: 'pointer',
                                background: i === searchHighlight ? '#252525' : 'transparent',
                                borderLeft: i === searchHighlight ? `2px solid ${r.category.color}` : '2px solid transparent',
                                transition: 'background 0.1s',
                              }}
                            >
                              <span style={{ fontSize: 12, width: 18, textAlign: 'center', flexShrink: 0 }}>
                                {r.category.icon}
                              </span>
                              <span style={{
                                color: r.category.color,
                                fontSize: 11,
                                fontWeight: 600,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {r.className}
                              </span>
                              <span style={{ color: '#555', fontSize: 9, flexShrink: 0 }}>
                                #{r.nodeIndex}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ width: 1, height: 28, background: '#333' }} />

                {/* Edge type toggle */}
                <button
                  onClick={() => setEdgeType(t => t === 'smoothstep' ? 'bezier' : 'smoothstep')}
                  style={{
                    background: '#1A1A1A',
                    color: '#E0E0E0',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: '5px 10px',
                    fontSize: 10,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#E85D3A')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
                  title={`Edge style: ${edgeType === 'smoothstep' ? 'Angular' : 'Curved'}`}
                >
                  <span style={{ fontSize: 14 }}>{edgeType === 'smoothstep' ? '⊿' : '∿'}</span>
                  <span>{edgeType === 'smoothstep' ? 'Angular' : 'Curved'}</span>
                </button>
              </>
            )}
          </div>
        </Panel>

        {/* Edge navigation panel */}
        {selectedEdge && (
          <Panel position="bottom-center">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'linear-gradient(180deg, #1A1A1A 0%, #111 100%)',
              border: `1px solid ${selectedEdge.isVariable ? '#4EC9B0' : '#E85D3A'}55`,
              borderRadius: 8,
              boxShadow: `0 4px 20px ${selectedEdge.isVariable ? '#4EC9B044' : '#E85D3A44'}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
            }}>
              {/* Go to Source */}
              <button
                onClick={() => navigateToNode(selectedEdge.sourceId)}
                style={{
                  background: '#1A1A1A',
                  color: '#9CDCFE',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CDCFE'; e.currentTarget.style.background = '#1E2A35'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#1A1A1A'; }}
              >
                <span>◀</span>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedEdge.sourceLabel}
                </span>
              </button>

              {/* Connection info */}
              <div style={{
                color: selectedEdge.isVariable ? '#4EC9B0' : '#E85D3A',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 4px',
              }}>
                <span style={{ fontSize: 8, color: '#555' }}>{selectedEdge.isVariable ? 'VAR' : 'FLOW'}</span>
                <span>→</span>
              </div>

              {/* Go to Target */}
              <button
                onClick={() => navigateToNode(selectedEdge.targetId)}
                style={{
                  background: '#1A1A1A',
                  color: '#DCDCAA',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#DCDCAA'; e.currentTarget.style.background = '#2A2518'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#1A1A1A'; }}
              >
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedEdge.targetLabel}
                </span>
                <span>▶</span>
              </button>

              {/* Close */}
              <button
                onClick={() => setSelectedEdge(null)}
                style={{
                  background: 'transparent',
                  color: '#555',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#E0E0E0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
              >
                ✕
              </button>
            </div>
          </Panel>
        )}

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

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
