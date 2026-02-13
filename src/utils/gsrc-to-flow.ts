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

/** Simple auto-layout: arrange nodes in a grid */
function autoLayout(nodeCount: number, index: number): { x: number; y: number } {
  const cols = Math.max(4, Math.ceil(Math.sqrt(nodeCount)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * 320,
    y: row * 250,
  };
}

export function gsrcToFlow(file: GSrcFile): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const flowNodes: Node<NodeData>[] = [];
  const flowEdges: Edge[] = [];

  // Create flow nodes
  for (let i = 0; i < file.graph.nodes.length; i++) {
    const gsNode = file.graph.nodes[i];
    const className = gsNode._resolvedClass ?? resolveHash(gsNode.classHash);
    const category = getNodeCategory(className);

    const inputPins = extractPins(gsNode.dataSet, HASH_INPUT_PINS);
    const outputPins = extractPins(gsNode.dataSet, HASH_OUTPUT_PINS);
    const variablePins = extractPins(gsNode.dataSet, HASH_VARIABLE_PINS);
    const parameters = extractParameters(gsNode.dataSet);

    const pos = autoLayout(file.graph.nodes.length, i);

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
    const sourceHandle = `out-${conn.sourceOutputPinHash}`;
    const targetHandle = `in-${conn.targetInputPinHash}`;

    flowEdges.push({
      id: `edge-${ci}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#E85D3A', strokeWidth: 2 },
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
}
