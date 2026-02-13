/**
 * ADF (Avalanche Data Format) parser for Mad Max .gsrc files.
 * 
 * ADF is a self-describing binary format. The file contains:
 * 1. Header with version, offsets to instances and types
 * 2. Type definitions (struct layouts, scalars, arrays, etc.)
 * 3. Instance entries (name, type, payload offset/size)
 * 4. Payload data (the actual struct data)
 * 
 * For .gsrc files, the payload contains a GSGraph structure that is
 * deserialized according to the embedded type definitions.
 */

import type { AdfHeader, AdfInstance, AdfType, AdfTypeMember, AdfTypeKind } from '../types/graphscript';

const ADF_MAGIC_LE = 0x41444620; // "ADF " little-endian
const ADF_MAGIC_BE = 0x20464441; // " FDA" big-endian

export class AdfReader {
  private view: DataView;
  private data: Uint8Array;
  private littleEndian: boolean = true;
  
  public header!: AdfHeader;
  public types: Map<number, AdfType> = new Map();
  public instances: AdfInstance[] = [];

  constructor(buffer: ArrayBuffer) {
    this.data = new Uint8Array(buffer);
    this.view = new DataView(buffer);
  }

  parse(): void {
    this.parseHeader();
    this.parseTypes();
    this.parseInstances();
  }

  private parseHeader(): void {
    const magic = this.view.getUint32(0, true);
    if (magic === ADF_MAGIC_LE) {
      this.littleEndian = true;
    } else if (magic === ADF_MAGIC_BE) {
      this.littleEndian = false;
    } else {
      throw new Error(`Invalid ADF magic: 0x${magic.toString(16)}`);
    }

    const version = this.view.getUint32(4, this.littleEndian);

    if (version === 4) {
      this.header = {
        fourCC: magic,
        version,
        instanceCount: this.view.getUint32(8, this.littleEndian),
        firstInstanceOffset: this.view.getUint32(12, this.littleEndian),
        typeCount: this.view.getUint32(16, this.littleEndian),
        firstTypeOffset: this.view.getUint32(20, this.littleEndian),
        stringHashCount: this.view.getUint32(24, this.littleEndian),
        firstStringHashOffset: this.view.getUint32(28, this.littleEndian),
        stringCount: this.view.getUint32(32, this.littleEndian),
        firstStringDataOffset: this.view.getUint32(36, this.littleEndian),
        fileSize: this.view.getUint32(40, this.littleEndian),
        description: this.readCString(64),
      };
    } else if (version === 3) {
      this.header = {
        fourCC: magic,
        version,
        instanceCount: this.view.getUint32(8, this.littleEndian),
        firstInstanceOffset: this.view.getUint32(12, this.littleEndian),
        typeCount: this.view.getUint32(16, this.littleEndian),
        firstTypeOffset: this.view.getUint32(20, this.littleEndian),
        stringHashCount: this.view.getUint32(24, this.littleEndian),
        firstStringHashOffset: this.view.getUint32(28, this.littleEndian),
        stringCount: 0,
        firstStringDataOffset: 0,
        fileSize: 0,
        description: '',
      };
    } else if (version === 2) {
      this.header = {
        fourCC: magic,
        version,
        instanceCount: this.view.getUint32(8, this.littleEndian),
        firstInstanceOffset: this.view.getUint32(12, this.littleEndian),
        typeCount: this.view.getUint32(16, this.littleEndian),
        firstTypeOffset: this.view.getUint32(20, this.littleEndian),
        stringHashCount: 0,
        firstStringHashOffset: 0,
        stringCount: 0,
        firstStringDataOffset: 0,
        fileSize: 0,
        description: '',
      };
    } else {
      throw new Error(`Unsupported ADF version: ${version}`);
    }
  }

  private parseTypes(): void {
    let offset = this.header.firstTypeOffset;
    
    for (let i = 0; i < this.header.typeCount; i++) {
      const typeStart = offset;
      
      const adfType = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const size = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const alignment = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const nameHash = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const nameOffset = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const flags = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const memberCount = this.view.getUint32(offset, this.littleEndian); offset += 4;
      const membersOffset = this.view.getUint32(offset, this.littleEndian); offset += 4;
      
      // Read name from string table
      const name = this.readTypeName(typeStart, nameOffset);
      
      // Parse members
      const members: AdfTypeMember[] = [];
      if (memberCount > 0 && membersOffset > 0) {
        let memberOff = typeStart + membersOffset;
        for (let m = 0; m < memberCount; m++) {
          const mNameHash = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mTypeHash = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mOffset = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mSize = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mBitOffset = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mDefaultValue = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mNameOff = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          const mFlags = this.view.getUint32(memberOff, this.littleEndian); memberOff += 4;
          
          members.push({
            name: this.readTypeName(typeStart, mNameOff),
            nameHash: mNameHash,
            typeHash: mTypeHash,
            size: mSize,
            offset: mOffset & 0xFFFFFF,
            defaultValue: mDefaultValue,
            bitOffset: mBitOffset,
          });
        }
      }

      const type: AdfType = {
        nameHash,
        name,
        adfType: adfType as AdfTypeKind,
        size,
        alignment,
        memberCount,
        members,
      };

      // For array types, parse sub-type
      if (adfType === 3 /* Array */ || adfType === 4 /* InlineArray */) {
        if (members.length > 0) {
          type.subTypeHash = members[0].typeHash;
        }
      }

      this.types.set(nameHash, type);
      
      // Advance to next type (each type entry has variable size)
      offset = typeStart + 32 + memberCount * 32;
    }
  }

  private parseInstances(): void {
    let offset = this.header.firstInstanceOffset;
    
    for (let i = 0; i < this.header.instanceCount; i++) {
      if (this.header.version >= 4) {
        const nameHash = this.view.getUint32(offset, this.littleEndian);
        const typeHash = this.view.getUint32(offset + 4, this.littleEndian);
        const payloadOffset = this.view.getUint32(offset + 8, this.littleEndian);
        const payloadSize = this.view.getUint32(offset + 12, this.littleEndian);
        const nameIdx = this.view.getUint32(offset + 16, this.littleEndian);
        
        // Try to read name from string data
        let name = `instance_${i}`;
        if (this.header.firstStringDataOffset > 0 && nameIdx < this.header.stringCount) {
          // Resolve from string table
          name = this.readStringFromTable(nameIdx);
        }
        
        this.instances.push({
          nameHash,
          typeHash,
          payloadOffset,
          payloadSize,
          name,
        });
        offset += 24;
      } else {
        const nameHash = this.view.getUint32(offset, this.littleEndian);
        const typeHash = this.view.getUint32(offset + 4, this.littleEndian);
        const payloadOffset = this.view.getUint32(offset + 8, this.littleEndian);
        const payloadSize = this.view.getUint32(offset + 12, this.littleEndian);
        
        this.instances.push({
          nameHash,
          typeHash,
          payloadOffset,
          payloadSize,
          name: `instance_${i}`,
        });
        offset += 48;
      }
    }
  }

  /** Read a null-terminated string at absolute offset */
  readCString(offset: number): string {
    let end = offset;
    while (end < this.data.length && this.data[end] !== 0) end++;
    return new TextDecoder().decode(this.data.subarray(offset, end));
  }

  /** Read type name from relative offset within type block */
  private readTypeName(typeStart: number, nameOffset: number): string {
    if (nameOffset === 0) return '';
    return this.readCString(typeStart + nameOffset);
  }

  /** Read string from the string data table */
  private readStringFromTable(index: number): string {
    let offset = this.header.firstStringDataOffset;
    for (let i = 0; i < index; i++) {
      while (offset < this.data.length && this.data[offset] !== 0) offset++;
      offset++; // skip null terminator
    }
    return this.readCString(offset);
  }

  /** Get raw payload bytes for an instance */
  getPayload(instance: AdfInstance): Uint8Array {
    return this.data.subarray(
      instance.payloadOffset,
      instance.payloadOffset + instance.payloadSize
    );
  }

  /** Read uint32 from payload at offset */
  readU32(payloadOffset: number, localOffset: number): number {
    return this.view.getUint32(payloadOffset + localOffset, this.littleEndian);
  }

  /** Read uint8 from absolute offset */
  readU8(offset: number): number {
    return this.data[offset];
  }

  get isLittleEndian(): boolean {
    return this.littleEndian;
  }

  get buffer(): ArrayBufferLike {
    return this.view.buffer;
  }

  get rawData(): Uint8Array {
    return this.data;
  }
}
