/**
 * Converts parsed GSrcFile data into React Flow nodes and edges
 * for visualization in the node editor.
 */

import type { Node, Edge } from '@xyflow/react';
import type { GSrcFile, GSNode, GSDataSet, GSData, GSConnection } from '../types/graphscript';
import { resolveHash, hashString } from './hash';
import { getNodeCategory } from './node-categories';

const HASH_INPUT_PINS = hashString('input_pins');
const HASH_OUTPUT_PINS = hashString('output_pins');
const HASH_VARIABLE_PINS = hashString('variable_pins');

export interface PinInfo {
  hash: number;
  name: string;
  data: GSData[];
}

export interface NodeData {
  [key: string]: unknown;
  label: string;
  classHash: number;
  className: string;
  category: ReturnType<typeof getNodeCategory>;
  nodeIndex: number;
  gsNode: GSNode;
  inputPins: PinInfo[];
  outputPins: PinInfo[];
  variablePins: PinInfo[];
  parameters: GSData[];
}

function extractPins(ds: GSDataSet, pinCategoryHash: number): PinInfo[] {
  const pinCategory = ds.dataSets.find(child => child.name === pinCategoryHash);
  if (!pinCategory) return [];

  return pinCategory.dataSets.map(pinDS => ({
    hash: pinDS.name,
    name: resolveHash(pinDS.name),
    data: pinDS.data,
  }));
}

function extractParameters(ds: GSDataSet): GSData[] {
  return ds.data;
}

/** Layered graph layout (Sugiyama-style) for left-to-right flow visualization.
 *  1. Topological sort + longest-path layer assignment (O(V+E), no re-visiting)
 *  2. Layer compaction: promote nodes to reduce max layer height
 *  3. Barycenter ordering to reduce crossings (8 sweep passes)
 *  4. Variable nodes placed in a dedicated grid zone
 */
function layoutNodes(
  nodeCount: number,
  connections: GSConnection[],
): Map<number, { x: number; y: number }> {
  const LAYER_GAP_X = 360;
  const LAYER_GAP_Y = 140;
  const NODE_W = 300;
  const MAX_PER_LAYER = 4;  // max nodes per layer before splitting

  // Separate flow and variable connections
  const flowEdges = connections.filter(c => c.connectionType === 'flow');
  const varEdges = connections.filter(c => c.connectionType === 'variable');

  // Build adjacency for flow edges
  const children: number[][] = Array.from({ length: nodeCount }, () => []);
  const parents: number[][] = Array.from({ length: nodeCount }, () => []);
  const inDegree = new Int32Array(nodeCount);
  const varNodes = new Set<number>();

  for (const e of flowEdges) {
    children[e.sourceNodeIndex].push(e.targetNodeIndex);
    parents[e.targetNodeIndex].push(e.sourceNodeIndex);
    inDegree[e.targetNodeIndex]++;
  }
  for (const e of varEdges) {
    varNodes.add(e.sourceNodeIndex);
  }

  // Functional nodes = everything except pure variable sources
  const funcNodes = new Set<number>();
  for (let i = 0; i < nodeCount; i++) {
    if (!varNodes.has(i)) funcNodes.add(i);
  }

  // --- Layer assignment via Kahn's topological sort (longest path, O(V+E)) ---
  const layer = new Int32Array(nodeCount);

  const funcInDeg = new Int32Array(nodeCount);
  for (const n of funcNodes) {
    for (const p of parents[n]) {
      if (funcNodes.has(p)) funcInDeg[n]++;
    }
  }

  const queue: number[] = [];
  for (const n of funcNodes) {
    if (funcInDeg[n] === 0) {
      queue.push(n);
      layer[n] = 0;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const child of children[cur]) {
      if (!funcNodes.has(child)) continue;
      const newLayer = layer[cur] + 1;
      if (newLayer > layer[child]) layer[child] = newLayer;
      funcInDeg[child]--;
      if (funcInDeg[child] === 0) {
        queue.push(child);
      }
    }
  }

  // --- Layer compaction: promote nodes to earliest valid layer ---
  // Longest-path pushes nodes as far right as possible.
  // Compact by moving each node to the minimum layer where it's still
  // after all its parents (min layer = max parent layer + 1).
  // Process in topological order (queue is already sorted).
  for (const n of queue) {
    let minLayer = 0;
    for (const p of parents[n]) {
      if (funcNodes.has(p)) {
        const pl = layer[p] + 1;
        if (pl > minLayer) minLayer = pl;
      }
    }
    layer[n] = minLayer;
  }

  // --- Group functional nodes by layer ---
  let layerGroups = new Map<number, number[]>();
  let maxLayer = 0;
  for (const n of funcNodes) {
    const l = layer[n];
    if (l > maxLayer) maxLayer = l;
    let group = layerGroups.get(l);
    if (!group) { group = []; layerGroups.set(l, group); }
    group.push(n);
  }

  // --- Split oversized layers: push excess nodes to sub-layers ---
  // If a layer has more than MAX_PER_LAYER nodes, split it into multiple
  // adjacent layers, shifting all downstream layers right.
  {
    const sortedLayers = [...layerGroups.keys()].sort((a, b) => b - a); // process right-to-left
    for (const l of sortedLayers) {
      const nodes = layerGroups.get(l)!;
      if (nodes.length <= MAX_PER_LAYER) continue;

      // Split into chunks
      const chunks: number[][] = [];
      for (let i = 0; i < nodes.length; i += MAX_PER_LAYER) {
        chunks.push(nodes.slice(i, i + MAX_PER_LAYER));
      }
      const extraLayers = chunks.length - 1;
      if (extraLayers === 0) continue;

      // Shift all layers > l to the right by extraLayers
      const newGroups = new Map<number, number[]>();
      for (const [gl, gn] of layerGroups) {
        if (gl > l) {
          newGroups.set(gl + extraLayers, gn);
          for (const n of gn) layer[n] = gl + extraLayers;
        } else if (gl === l) {
          // Replace with chunks
          for (let ci = 0; ci < chunks.length; ci++) {
            newGroups.set(l + ci, chunks[ci]);
            for (const n of chunks[ci]) layer[n] = l + ci;
          }
        } else {
          newGroups.set(gl, gn);
        }
      }
      layerGroups = newGroups;
      maxLayer += extraLayers;
    }
  }

  // --- Barycenter ordering to reduce edge crossings ---
  const nodeOrder = new Map<number, number>();
  for (const [, nodes] of layerGroups) {
    nodes.sort((a, b) => a - b);
    nodes.forEach((n, i) => nodeOrder.set(n, i));
  }

  // 8 sweep passes for better convergence
  for (let pass = 0; pass < 8; pass++) {
    const forward = pass % 2 === 0;
    for (let l = forward ? 1 : maxLayer - 1; forward ? l <= maxLayer : l >= 0; forward ? l++ : l--) {
      const nodes = layerGroups.get(l);
      if (!nodes || nodes.length <= 1) continue;

      const bary = new Map<number, number>();
      for (const n of nodes) {
        const adj = forward ? parents[n] : children[n];
        let sum = 0, count = 0;
        for (const a of adj) {
          if (funcNodes.has(a)) {
            sum += nodeOrder.get(a) ?? 0;
            count++;
          }
        }
        bary.set(n, count > 0 ? sum / count : nodeOrder.get(n) ?? 0);
      }

      nodes.sort((a, b) => (bary.get(a) ?? 0) - (bary.get(b) ?? 0));
      nodes.forEach((n, i) => nodeOrder.set(n, i));
    }
  }

  // --- Position functional nodes ---
  const positions = new Map<number, { x: number; y: number }>();

  for (const [l, nodes] of layerGroups) {
    nodes.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));
    const x = l * LAYER_GAP_X;
    const startY = -(nodes.length * LAYER_GAP_Y) / 2;
    for (let i = 0; i < nodes.length; i++) {
      positions.set(nodes[i], { x, y: startY + i * LAYER_GAP_Y });
    }
  }

  // --- Place variable nodes in a dedicated grid zone below the graph ---
  const VAR_CELL_W = 240;   // width per variable node cell
  const VAR_CELL_H = 100;   // height per variable node cell
  const VAR_COLS = 6;        // max columns in the variable grid
  const VAR_ZONE_GAP = 160;  // gap between functional graph and variable zone

  // Global bottom Y of functional nodes
  let globalBottomY = -Infinity;
  let globalMinX = Infinity;
  for (const [, pos] of positions) {
    if (pos.y > globalBottomY) globalBottomY = pos.y;
    if (pos.x < globalMinX) globalMinX = pos.x;
  }
  if (globalBottomY === -Infinity) globalBottomY = 0;
  if (globalMinX === Infinity) globalMinX = 0;

  const varBaseY = globalBottomY + VAR_ZONE_GAP;
  const varBaseX = globalMinX;

  // Collect all variable nodes (connected first, then unconnected)
  const allVarNodes: number[] = [];
  const varConnected = new Set<number>();
  for (const e of varEdges) {
    varConnected.add(e.sourceNodeIndex);
  }
  // Connected variable nodes first (sorted by index for stability)
  for (const vn of [...varConnected].sort((a, b) => a - b)) {
    allVarNodes.push(vn);
  }
  // Unconnected variable nodes after
  for (const vn of [...varNodes].sort((a, b) => a - b)) {
    if (!varConnected.has(vn)) allVarNodes.push(vn);
  }

  // Place in grid
  for (let i = 0; i < allVarNodes.length; i++) {
    const col = i % VAR_COLS;
    const row = Math.floor(i / VAR_COLS);
    positions.set(allVarNodes[i], {
      x: varBaseX + col * VAR_CELL_W,
      y: varBaseY + row * VAR_CELL_H,
    });
  }

  // Any remaining unpositioned nodes
  const remainingBaseY = allVarNodes.length > 0
    ? varBaseY + (Math.floor((allVarNodes.length - 1) / VAR_COLS) + 1) * VAR_CELL_H + VAR_ZONE_GAP
    : varBaseY + VAR_ZONE_GAP;
  let extraCol = 0;
  for (let i = 0; i < nodeCount; i++) {
    if (!positions.has(i)) {
      positions.set(i, { x: globalMinX + extraCol * NODE_W, y: remainingBaseY });
      extraCol++;
    }
  }

  return positions;
}

export function gsrcToFlow(file: GSrcFile): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const flowNodes: Node<NodeData>[] = [];
  const flowEdges: Edge[] = [];

  // Compute layout positions based on connections
  const positions = layoutNodes(file.graph.nodes.length, file.connections);

  // Create flow nodes
  for (let i = 0; i < file.graph.nodes.length; i++) {
    const gsNode = file.graph.nodes[i];
    const className = gsNode._resolvedClass ?? resolveHash(gsNode.classHash);
    const category = getNodeCategory(className);

    const inputPins = extractPins(gsNode.dataSet, HASH_INPUT_PINS);
    const outputPins = extractPins(gsNode.dataSet, HASH_OUTPUT_PINS);
    const variablePins = extractPins(gsNode.dataSet, HASH_VARIABLE_PINS);
    const parameters = extractParameters(gsNode.dataSet);

    const pos = positions.get(i) ?? { x: i * 320, y: 0 };

    flowNodes.push({
      id: `node-${i}`,
      type: 'gsNode',
      position: pos,
      data: {
        label: className,
        classHash: gsNode.classHash,
        className,
        category,
        nodeIndex: i,
        gsNode,
        inputPins,
        outputPins,
        variablePins,
        parameters,
      },
    });
  }

  // Create flow edges from connections
  for (let ci = 0; ci < file.connections.length; ci++) {
    const conn = file.connections[ci];
    const sourceId = `node-${conn.sourceNodeIndex}`;
    const targetId = `node-${conn.targetNodeIndex}`;

    let sourceHandle: string;
    let targetHandle: string;
    let edgeStyle: { stroke: string; strokeWidth: number };

    if (conn.connectionType === 'variable') {
      // Variable connection: VariableNode → FunctionalNode.variablePin
      sourceHandle = `var-out-${conn.sourceNodeIndex}`;
      targetHandle = `var-${conn.targetInputPinHash}`;
      edgeStyle = { stroke: '#4EC9B0', strokeWidth: 1.5 };
    } else {
      // Flow connection: sourceNode.outputPin → targetNode.inputPin
      sourceHandle = `out-${conn.sourceOutputPinHash}`;
      targetHandle = `in-${conn.targetInputPinHash}`;
      edgeStyle = { stroke: '#E85D3A', strokeWidth: 2 };
    }

    flowEdges.push({
      id: `edge-${ci}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: false,
      style: edgeStyle,
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
}
