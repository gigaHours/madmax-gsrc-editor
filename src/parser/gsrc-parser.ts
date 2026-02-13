import type { GSGraph, GSNode, GSDataSet, GSData, GSConnection, GSrcFile } from '../types/graphscript';
import { AdfReader } from './adf-reader';
import { resolveHash, hashString } from '../utils/hash';

const HASH_OUTPUT_PINS = hashString('output_pins');
const HASH_VARIABLE_PINS = hashString('variable_pins');

export class GsrcParser {
  private adf: AdfReader;
  private P = 0;
  private view!: DataView;
  private data!: Uint8Array;
  private le = true;

  constructor(buffer: ArrayBuffer) { this.adf = new AdfReader(buffer); }

  parse(): GSrcFile {
    this.adf.parse();
    this.le = this.adf.isLittleEndian;
    this.data = this.adf.rawData;
    this.view = new DataView(this.adf.buffer);
    const inst = this.adf.instances[0];
    if (!inst) throw new Error('No instances in ADF');
    this.P = inst.payloadOffset;
    const graph = this.parseGraph(this.P);
    this.resolveVariableNodeData(graph);
    const connections = this.extractConnections(graph);
    return { graph, connections, internalData: this.data.subarray(this.P, this.P + inst.payloadSize), adfVersion: this.adf.header.version, rawBuffer: this.adf.buffer };
  }

  private abs(rel: number) { return this.P + rel; }
  private u32(off: number) { return this.view.getUint32(off, this.le); }

  private parseGraph(base: number): GSGraph {
    const nodesRel = this.u32(base);
    const nodesCount = this.u32(base + 0x08);
    const globalData = this.parseData(base + 0x10);
    const nodes: GSNode[] = [];
    if (nodesRel > 0 && nodesCount > 0) {
      const a = this.abs(nodesRel);
      for (let i = 0; i < nodesCount; i++) {
        const n = this.parseNode(a + i * 0x40);
        n._index = i;
        nodes.push(n);
      }
    }
    return { nodes, data: globalData };
  }

  private parseNode(base: number): GSNode {
    const classHash = this.u32(base);
    const functionHash = this.u32(base + 0x08);
    const dataSet = this.parseDataSet(base + 0x10);
    return { classHash, functionHash, dataSet, _resolvedClass: resolveHash(classHash) };
  }

  private parseDataSet(base: number): GSDataSet {
    const name = this.u32(base);
    const dataRel = this.u32(base + 0x08);
    const dataCount = this.u32(base + 0x10);
    const dsRel = this.u32(base + 0x18);
    const dsCount = this.u32(base + 0x20);

    const data: GSData[] = [];
    if (dataRel > 0 && dataCount > 0) {
      const a = this.abs(dataRel);
      for (let i = 0; i < dataCount; i++) data.push(this.parseData(a + i * 0x20));
    }
    const dataSets: GSDataSet[] = [];
    if (dsRel > 0 && dsCount > 0) {
      const a = this.abs(dsRel);
      for (let i = 0; i < dsCount; i++) dataSets.push(this.parseDataSet(a + i * 0x30));
    }
    return { name, data, dataSets, _resolvedName: resolveHash(name) };
  }

  private parseData(base: number): GSData {
    const name = this.u32(base);
    const type = this.u32(base + 0x04);
    const valRel = this.u32(base + 0x08);
    const valCount = this.u32(base + 0x10);
    const reference = this.data[base + 0x18] !== 0;

    let value = new Uint8Array(0);
    if (valRel > 0 && valCount > 0) {
      const a = this.abs(valRel);
      value = new Uint8Array(valCount);
      value.set(this.data.subarray(a, a + valCount));
    }

    const d: GSData = { name, type, value, count: valCount, reference, _resolvedName: resolveHash(name), _resolvedType: resolveHash(type) };
    d._displayValue = this.fmtVal(d);
    return d;
  }

  private fmtVal(d: GSData): string {
    if (d.value.length === 0) return '(empty)';
    const dv = new DataView(d.value.buffer, d.value.byteOffset, d.value.byteLength);
    const t = d._resolvedType ?? '';
    try {
      if (t === 'float' && d.value.length >= 4) return dv.getFloat32(0, this.le).toFixed(4);
      if (t === 'int' && d.value.length >= 4) return dv.getInt32(0, this.le).toString();
      if (t === 'uint32' && d.value.length >= 4) { const v = dv.getUint32(0, this.le); const r = resolveHash(v); return r.startsWith('0x') ? v.toString() : `${v} (${r})`; }
      if (t === 'bool' && d.value.length >= 1) return d.value[0] ? 'true' : 'false';
      if (t === 'int64' && d.value.length >= 8) return dv.getBigInt64(0, this.le).toString();
      if (t === 'uint64' && d.value.length >= 8) return dv.getBigUint64(0, this.le).toString();
      if (t === 'vector' && d.value.length >= 16) return `(${dv.getFloat32(0,this.le).toFixed(2)}, ${dv.getFloat32(4,this.le).toFixed(2)}, ${dv.getFloat32(8,this.le).toFixed(2)}, ${dv.getFloat32(12,this.le).toFixed(2)})`;
      if (t === 'enum' && d.value.length >= 4) return dv.getInt32(0, this.le).toString();
      if ((t === 'string' || t === 'string_ptr') && d.value.length > 0) return new TextDecoder().decode(d.value);
    } catch {}
    const hex = Array.from(d.value.subarray(0, Math.min(16, d.value.length))).map(b => b.toString(16).padStart(2, '0')).join(' ');
    return d.value.length > 16 ? `${hex}...` : hex;
  }

  /** Dereference Variable node fields through the global data blob.
   *  Variable nodes store Name and Value as offsets into the global data.
   *  - Name offset → uint32 hash (the variable's identity/name)
   *  - Value offset → actual value (type depends on variable class)
   */
  private resolveVariableNodeData(graph: GSGraph): void {
    const globalData = graph.data.value;
    if (globalData.length === 0) return;
    const gdv = new DataView(globalData.buffer, globalData.byteOffset, globalData.byteLength);

    for (const node of graph.nodes) {
      const cls = node._resolvedClass ?? '';
      if (!/^(Variable|ExternalVariable|GlobalVariable)/.test(cls)) continue;

      // Determine value type from class name
      const varType = this.getVariableValueType(cls);

      for (const d of node.dataSet.data) {
        const fieldName = d._resolvedName ?? '';
        if (d.value.length < 4) continue;
        const dv = new DataView(d.value.buffer, d.value.byteOffset, d.value.byteLength);
        const offset = dv.getUint32(0, this.le);

        if (fieldName === 'Name') {
          // Name field: offset → uint32 name hash in global data
          if (offset + 4 <= globalData.length) {
            const nameHash = gdv.getUint32(offset, this.le);
            const resolved = resolveHash(nameHash);
            d._displayValue = resolved;
            d._resolvedType = 'uint32';
          }
        } else if (fieldName === 'Value' && d.reference) {
          // Value field: offset → actual value in global data
          if (offset < globalData.length) {
            d._displayValue = this.fmtGlobalValue(gdv, offset, globalData.length, varType);
          }
        }
      }
    }
  }

  /** Get the expected value type from a variable class name */
  private getVariableValueType(cls: string): string {
    const base = cls.replace(/^(External|Global)/, '');
    if (base.startsWith('VariableFloat')) return 'float';
    if (base.startsWith('VariableInt')) return 'int';
    if (base.startsWith('VariableBool')) return 'bool';
    if (base.startsWith('VariableUint32')) return 'uint32';
    if (base.startsWith('VariableUint64')) return 'uint64';
    if (base === 'VariableString' || base === 'VariableStringHash') return 'string_hash';
    if (base.startsWith('VariableVector')) return 'vector';
    if (base.startsWith('VariableHash') || base === 'VariableStringHash') return 'string_hash';
    if (base.startsWith('VariableEnum')) return 'enum';
    if (base.startsWith('VariableTransform')) return 'vector';
    if (base.startsWith('VariableEventSend') || base.startsWith('VariableEventReceive')) return 'event';
    if (base.startsWith('VariableObject') || base.startsWith('VariableFile') || base.startsWith('VariableGraphFile') || base.startsWith('VariableGlobalRef')) return 'uint64';
    return 'uint32';
  }

  /** Format a value read from the global data blob at a given offset */
  private fmtGlobalValue(gdv: DataView, offset: number, len: number, varType: string): string {
    try {
      if (varType === 'float' && offset + 4 <= len) {
        return gdv.getFloat32(offset, this.le).toFixed(4);
      }
      if (varType === 'int' && offset + 4 <= len) {
        return gdv.getInt32(offset, this.le).toString();
      }
      if (varType === 'uint32' && offset + 4 <= len) {
        const v = gdv.getUint32(offset, this.le);
        const r = resolveHash(v);
        return r.startsWith('0x') ? v.toString() : `${v} (${r})`;
      }
      if (varType === 'bool' && offset + 1 <= len) {
        return gdv.getUint8(offset) ? 'true' : 'false';
      }
      if (varType === 'uint64' && offset + 8 <= len) {
        return gdv.getBigUint64(offset, this.le).toString();
      }
      if (varType === 'enum' && offset + 4 <= len) {
        return gdv.getInt32(offset, this.le).toString();
      }
      if (varType === 'string_hash' && offset + 4 <= len) {
        const v = gdv.getUint32(offset, this.le);
        const r = resolveHash(v);
        return r;
      }
      if (varType === 'vector' && offset + 16 <= len) {
        return `(${gdv.getFloat32(offset, this.le).toFixed(2)}, ${gdv.getFloat32(offset + 4, this.le).toFixed(2)}, ${gdv.getFloat32(offset + 8, this.le).toFixed(2)}, ${gdv.getFloat32(offset + 12, this.le).toFixed(2)})`;
      }
      if (varType === 'event') {
        return '(event)';
      }
    } catch {}
    // Fallback: show raw hex
    if (offset + 4 <= len) {
      return `0x${gdv.getUint32(offset, this.le).toString(16).padStart(8, '0').toUpperCase()}`;
    }
    return '??';
  }

  /** Resolve a connection value (offset into global data blob) to a target node index */
  private resolveConnectionTarget(globalDataValue: Uint8Array, offset: number): number | null {
    if (globalDataValue.length === 0 || offset + 4 > globalDataValue.length) return null;
    const dv = new DataView(globalDataValue.buffer, globalDataValue.byteOffset, globalDataValue.byteLength);
    return dv.getUint32(offset, this.le);
  }

  extractConnections(graph: GSGraph): GSConnection[] {
    const conns: GSConnection[] = [];
    const globalData = graph.data.value;

    for (let ni = 0; ni < graph.nodes.length; ni++) {
      const node = graph.nodes[ni];

      // Extract connections from output_pins
      const outDS = node.dataSet.dataSets.find(ds => ds.name === HASH_OUTPUT_PINS);
      if (outDS) {
        for (const pinDS of outDS.dataSets) {
          for (const cd of pinDS.data) {
            if (cd.value.length >= 4) {
              const dv = new DataView(cd.value.buffer, cd.value.byteOffset, cd.value.byteLength);
              const gdOffset = dv.getUint32(0, this.le);
              const ti = this.resolveConnectionTarget(globalData, gdOffset);
              if (ti !== null && ti < graph.nodes.length) {
                conns.push({ sourceNodeIndex: ni, sourceOutputPinHash: pinDS.name, targetNodeIndex: ti, targetInputPinHash: cd.name, connectionType: 'flow', _sourceOutputPin: resolveHash(pinDS.name), _targetInputPin: resolveHash(cd.name) });
              }
            }
          }
        }
      }

      // Extract connections from variable_pins
      const varDS = node.dataSet.dataSets.find(ds => ds.name === HASH_VARIABLE_PINS);
      if (varDS) {
        for (const pinDS of varDS.dataSets) {
          for (const cd of pinDS.data) {
            if (cd.value.length >= 4) {
              const dv = new DataView(cd.value.buffer, cd.value.byteOffset, cd.value.byteLength);
              const gdOffset = dv.getUint32(0, this.le);
              const ti = this.resolveConnectionTarget(globalData, gdOffset);
              if (ti !== null && ti < graph.nodes.length) {
                conns.push({ sourceNodeIndex: ti, sourceOutputPinHash: pinDS.name, targetNodeIndex: ni, targetInputPinHash: pinDS.name, connectionType: 'variable', _sourceOutputPin: resolveHash(pinDS.name), _targetInputPin: resolveHash(pinDS.name) });
              }
            }
          }
        }
      }
    }
    return conns;
  }
}

export function parseGsrc(buffer: ArrayBuffer): GSrcFile {
  return new GsrcParser(buffer).parse();
}
