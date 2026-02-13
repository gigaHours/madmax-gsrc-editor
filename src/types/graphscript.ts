/**
 * GraphScript type definitions matching Mad Max engine structures.
 * All name/type fields are Jenkins lookup3 hashes of string identifiers.
 */

/** SGSData - individual data element */
export interface GSData {
  name: number;       // Hash of data name
  type: number;       // Hash of type string ("float", "int", "bool", etc.)
  value: Uint8Array;  // Raw value bytes
  count: number;      // m_Value.m_Count - byte count
  reference: boolean; // m_Reference - if true, value is an offset to a pointer
  // Resolved runtime fields (not in file)
  _resolvedName?: string;
  _resolvedType?: string;
  _displayValue?: string;
}

/** SGSDataSet - container for data and nested datasets */
export interface GSDataSet {
  name: number;           // Hash of dataset name
  data: GSData[];         // m_Data array
  dataSets: GSDataSet[];  // m_DataSets - nested datasets
  // Resolved runtime fields
  _resolvedName?: string;
}

/** SGSNode - a single node in the graph */
export interface GSNode {
  classHash: number;      // m_Class - hash of node type name
  functionHash: number;   // m_Function - stored as hash in file, resolved to function ptr at runtime
  dataSet: GSDataSet;     // m_DataSet - root dataset containing all node data
  // Resolved runtime fields
  _resolvedClass?: string;
  _index?: number;        // Index in the node array
}

/** SGSGraph - root graph structure */
export interface GSGraph {
  nodes: GSNode[];        // m_Nodes array
  data: GSData;           // m_Data - global graph data
}

/** Connection info extracted from output pins */
export interface GSConnection {
  sourceNodeIndex: number;
  sourceOutputPinHash: number;
  targetNodeIndex: number;
  targetInputPinHash: number;
  // Resolved names
  _sourceOutputPin?: string;
  _targetInputPin?: string;
}

/** Parsed .gsrc file */
export interface GSrcFile {
  graph: GSGraph;
  connections: GSConnection[];
  internalData: Uint8Array;  // The internal graph data buffer
  // ADF metadata
  adfVersion: number;
  rawBuffer: ArrayBufferLike;    // Original file for re-serialization
}

// ---- ADF format structures ----

export interface AdfHeader {
  fourCC: number;
  version: number;
  instanceCount: number;
  firstInstanceOffset: number;
  typeCount: number;
  firstTypeOffset: number;
  stringHashCount: number;
  firstStringHashOffset: number;
  stringCount: number;
  firstStringDataOffset: number;
  fileSize: number;
  description: string;
}

export interface AdfInstance {
  nameHash: number;
  typeHash: number;
  payloadOffset: number;
  payloadSize: number;
  name: string;
}

export const enum AdfTypeKind {
  Scalar = 0,
  Struct = 1,
  Pointer = 2,
  Array = 3,
  InlineArray = 4,
  String = 5,
  // BitField = 7,
  Enum = 8,
  StringHash = 9,
}

export interface AdfTypeMember {
  name: string;
  nameHash: number;
  typeHash: number;
  size: number;
  offset: number;
  defaultValue: number;
  bitOffset: number;
}

export interface AdfType {
  nameHash: number;
  name: string;
  adfType: AdfTypeKind;
  size: number;
  alignment: number;
  memberCount: number;
  members: AdfTypeMember[];
  subTypeHash?: number;
  elementLength?: number;
}

// Known type hashes
export const GS_TYPE_HASHES = {
  GSGraph: 0, // will be computed
  GSNode: 0,
  GSDataSet: 0,
  GSData: 0,
} as const;
