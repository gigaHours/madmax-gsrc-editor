import type { GSGraph, GSNode, GSDataSet, GSData, GSConnection, GSrcFile } from '../types/graphscript';
import { AdfReader } from './adf-reader';
import { resolveHash, hashString } from '../utils/hash';

const HASH_OUTPUT_PINS = hashString('output_pins');

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

  extractConnections(graph: GSGraph): GSConnection[] {
    const conns: GSConnection[] = [];
    for (let ni = 0; ni < graph.nodes.length; ni++) {
      const outDS = graph.nodes[ni].dataSet.dataSets.find(ds => ds.name === HASH_OUTPUT_PINS);
      if (!outDS) continue;
      for (const pinDS of outDS.dataSets) {
        for (const cd of pinDS.data) {
          if (cd.value.length >= 4) {
            const dv = new DataView(cd.value.buffer, cd.value.byteOffset, cd.value.byteLength);
            const ti = dv.getUint32(0, this.le);
            if (ti < graph.nodes.length) {
              conns.push({ sourceNodeIndex: ni, sourceOutputPinHash: pinDS.name, targetNodeIndex: ti, targetInputPinHash: cd.name, _sourceOutputPin: resolveHash(pinDS.name), _targetInputPin: resolveHash(cd.name) });
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
