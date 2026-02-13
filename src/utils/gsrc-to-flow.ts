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
 *  2. Barycenter ordering to reduce crossings
 *  3. Variable nodes placed below their connected functional nodes
 */
function layoutNodes(
  nodeCount: number,
  connections: GSConnection[],
): Map<number, { x: number; y: number }> {
  const LAYER_GAP_X = 360;
  const LAYER_GAP_Y = 200;
  const NODE_W = 300;

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
  const layer = new Int32Array(nodeCount); // layer[i] = 0 initially

  // Compute in-degree only among funcNodes
  const funcInDeg = new Int32Array(nodeCount);
  for (const n of funcNodes) {
    for (const p of parents[n]) {
      if (funcNodes.has(p)) funcInDeg[n]++;
    }
  }

  // Queue starts with all functional nodes with 0 in-degree
  const queue: number[] = [];
  for (const n of funcNodes) {
    if (funcInDeg[n] === 0) {
      queue.push(n);
      layer[n] = 0;
    }
  }

  // Process in topological order, assigning longest-path layer
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const child of children[cur]) {
      if (!funcNodes.has(child)) continue;
      // Longest path: child layer = max of all parent layers + 1
      const newLayer = layer[cur] + 1;
      if (newLayer > layer[child]) layer[child] = newLayer;
      funcInDeg[child]--;
      if (funcInDeg[child] === 0) {
        queue.push(child);
      }
    }
  }

  // Handle cycles: any funcNode not in queue gets assigned layer 0
  // (they are in a cycle - place at start)

  // --- Group functional nodes by layer ---
  const layerGroups = new Map<number, number[]>();
  let maxLayer = 0;
  for (const n of funcNodes) {
    const l = layer[n];
    if (l > maxLayer) maxLayer = l;
    let group = layerGroups.get(l);
    if (!group) { group = []; layerGroups.set(l, group); }
    group.push(n);
  }

  // --- Barycenter ordering to reduce edge crossings ---
  const nodeOrder = new Map<number, number>();
  for (const [, nodes] of layerGroups) {
    nodes.sort((a, b) => a - b);
    nodes.forEach((n, i) => nodeOrder.set(n, i));
  }

  // 4 sweep passes (forward/backward)
  for (let pass = 0; pass < 4; pass++) {
    const forward = pass % 2 === 0;
    for (let l = forward ? 1 : maxLayer - 1; forward ? l <= maxLayer : l >= 0; forward ? l++ : l--) {
      const nodes = layerGroups.get(l);
      if (!nodes || nodes.length <= 1) continue;

      const bary = new Map<number, number>();
      for (const n of nodes) {
        const adj = forward ? parents[n] : children[n];
        const targetLayer = forward ? l - 1 : l + 1;
        let sum = 0, count = 0;
        for (const a of adj) {
          if (funcNodes.has(a) && layer[a] === targetLayer) {
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

  // --- Place variable nodes below their targets ---
  const varTargets = new Map<number, Set<number>>();
  for (const e of varEdges) {
    let set = varTargets.get(e.sourceNodeIndex);
    if (!set) { set = new Set(); varTargets.set(e.sourceNodeIndex, set); }
    set.add(e.targetNodeIndex);
  }

  // Global bottom Y
  let globalBottomY = -Infinity;
  for (const [, pos] of positions) {
    if (pos.y > globalBottomY) globalBottomY = pos.y;
  }
  if (globalBottomY === -Infinity) globalBottomY = 0;

  const varBaseY = globalBottomY + LAYER_GAP_Y + 40;
  let varCol = 0;
  for (const [vn, targets] of varTargets) {
    let sumX = 0, count = 0;
    for (const t of targets) {
      const p = positions.get(t);
      if (p) { sumX += p.x; count++; }
    }
    positions.set(vn, {
      x: count > 0 ? sumX / count : varCol * NODE_W,
      y: varBaseY + varCol * 30, // slight stagger to avoid overlap
    });
    varCol++;
  }

  // Variable nodes without outgoing connections
  for (const vn of varNodes) {
    if (!positions.has(vn)) {
      positions.set(vn, { x: varCol * NODE_W, y: varBaseY });
      varCol++;
    }
  }

  // Any remaining unpositioned nodes
  let extraCol = 0;
  for (let i = 0; i < nodeCount; i++) {
    if (!positions.has(i)) {
      positions.set(i, { x: extraCol * NODE_W, y: varBaseY + LAYER_GAP_Y });
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
