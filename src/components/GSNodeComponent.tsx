import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeData, PinInfo } from '../utils/gsrc-to-flow';
import type { GSData } from '../types/graphscript';

const GSNodeComponent = memo(({ data, selected }: NodeProps & { data: NodeData }) => {
  const [expanded, setExpanded] = useState(false);
  const cat = data.category;

  const pinStyle = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    background: color,
    border: `2px solid ${color}`,
    borderRadius: '50%',
  });

  const maxPins = Math.max(data.inputPins.length, data.outputPins.length, 1);

  return (
    <div
      style={{
        background: cat.bgColor,
        border: `2px solid ${selected ? '#fff' : cat.borderColor}`,
        borderRadius: 6,
        minWidth: 220,
        maxWidth: 360,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
        color: '#E0E0E0',
        boxShadow: selected
          ? `0 0 20px ${cat.color}44, 0 0 40px ${cat.color}22`
          : `0 2px 8px rgba(0,0,0,0.5)`,
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${cat.color}33, ${cat.color}11)`,
          borderBottom: `1px solid ${cat.borderColor}44`,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: '4px 4px 0 0',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: 13 }}>{cat.icon}</span>
        <span style={{ fontWeight: 700, color: cat.color, flex: 1 }}>
          {data.className}
        </span>
        <span style={{ color: '#666', fontSize: 9 }}>#{data.nodeIndex}</span>
        <span style={{ color: '#666', fontSize: 9, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </div>

      {/* Pins */}
      <div style={{ padding: '4px 0' }}>
        {Array.from({ length: maxPins }).map((_, i) => {
          const inPin = data.inputPins[i];
          const outPin = data.outputPins[i];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 10px',
                position: 'relative',
                minHeight: 20,
              }}
            >
              {/* Input pin */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                {inPin && (
                  <>
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`in-${inPin.hash}`}
                      style={{ ...pinStyle('#569CD6'), position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <span style={{ color: '#9CDCFE', fontSize: 10 }}>
                      {inPin.name}
                    </span>
                  </>
                )}
              </div>
              {/* Output pin */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flex: 1 }}>
                {outPin && (
                  <>
                    <span style={{ color: '#DCDCAA', fontSize: 10 }}>
                      {outPin.name}
                    </span>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`out-${outPin.hash}`}
                      style={{ ...pinStyle('#E85D3A'), position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Variable pins (shown below) */}
        {data.variablePins.length > 0 && (
          <div style={{ borderTop: `1px solid ${cat.borderColor}22`, margin: '2px 0' }}>
            {data.variablePins.map((vp, vi) => (
              <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', position: 'relative' }}>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`var-${vp.hash}`}
                  style={{ ...pinStyle('#4EC9B0'), position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)' }}
                />
                <span style={{ color: '#4EC9B0', fontSize: 10 }}>⬢ {vp.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: Parameters */}
      {expanded && data.parameters.length > 0 && (
        <div style={{
          borderTop: `1px solid ${cat.borderColor}33`,
          padding: '6px 10px',
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          <div style={{ color: '#888', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            Parameters
          </div>
          {data.parameters.map((param, pi) => (
            <ParameterRow key={pi} param={param} />
          ))}
        </div>
      )}
    </div>
  );
});

GSNodeComponent.displayName = 'GSNodeComponent';

function ParameterRow({ param }: { param: GSData }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1px 0',
      gap: 8,
    }}>
      <span style={{ color: '#9CDCFE', fontSize: 10, whiteSpace: 'nowrap' }}>
        {param._resolvedName ?? '??'}
      </span>
      <span style={{ color: '#CE9178', fontSize: 10, textAlign: 'right', wordBreak: 'break-all', maxWidth: 150 }}>
        {param._displayValue ?? '??'}
      </span>
    </div>
  );
}

export default GSNodeComponent;
