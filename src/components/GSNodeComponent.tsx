import React, { memo, useState, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeData, PinInfo } from '../utils/gsrc-to-flow';
import type { GSData } from '../types/graphscript';

// Pre-computed pin handle styles (avoid creating new objects every render)
const PIN_STYLE_BLUE: React.CSSProperties = {
  width: 10, height: 10,
  background: '#569CD6', border: '2px solid #569CD6', borderRadius: '50%',
  position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
};
const PIN_STYLE_ORANGE: React.CSSProperties = {
  width: 10, height: 10,
  background: '#E85D3A', border: '2px solid #E85D3A', borderRadius: '50%',
  position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
};
const PIN_STYLE_TEAL_LEFT: React.CSSProperties = {
  width: 10, height: 10,
  background: '#4EC9B0', border: '2px solid #4EC9B0', borderRadius: '50%',
  position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
};
const PIN_STYLE_TEAL_RIGHT: React.CSSProperties = {
  width: 10, height: 10,
  background: '#4EC9B0', border: '2px solid #4EC9B0', borderRadius: '50%',
  position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
};

const PIN_ROW_STYLE: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '2px 10px', position: 'relative', minHeight: 20,
};
const PIN_LEFT_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, flex: 1 };
const PIN_RIGHT_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flex: 1 };
const IN_LABEL_STYLE: React.CSSProperties = { color: '#9CDCFE', fontSize: 10 };
const OUT_LABEL_STYLE: React.CSSProperties = { color: '#DCDCAA', fontSize: 10 };
const VAR_ROW_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', position: 'relative' };
const VAR_LABEL_STYLE: React.CSSProperties = { color: '#4EC9B0', fontSize: 10 };
const VAR_OUT_WRAP: React.CSSProperties = { position: 'relative', minHeight: 10 };
const VAR_VALUE_STYLE: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, color: '#4EC9B0', fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 6,
};
const VAR_VALUE_NAME_STYLE: React.CSSProperties = { color: '#9CDCFE', fontSize: 9, fontWeight: 400 };
const VAR_VALUE_VAL_STYLE: React.CSSProperties = { color: '#CE9178', fontSize: 11, fontWeight: 600, marginLeft: 'auto', maxWidth: 160, textAlign: 'right' as const, wordBreak: 'break-all' as const };
const PINS_WRAP: React.CSSProperties = { padding: '4px 0' };
const PARAM_NAME_STYLE: React.CSSProperties = { color: '#9CDCFE', fontSize: 10, whiteSpace: 'nowrap' };
const PARAM_VAL_STYLE: React.CSSProperties = { color: '#CE9178', fontSize: 10, textAlign: 'right', wordBreak: 'break-all', maxWidth: 150 };
const PARAM_ROW_STYLE: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0', gap: 8 };
const PARAM_HEADER_STYLE: React.CSSProperties = { color: '#888', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 };

const GSNodeComponent = memo(({ data, selected }: NodeProps & { data: NodeData }) => {
  const [expanded, setExpanded] = useState(false);
  const cat = data.category;
  const isVariableNode = /^(Variable|ExternalVariable|GlobalVariable)/.test(data.className);

  const maxPins = Math.max(data.inputPins.length, data.outputPins.length, 1);

  // Memoize container style
  const containerStyle = useMemo((): React.CSSProperties => ({
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
  }), [cat.bgColor, cat.borderColor, cat.color, selected]);

  const headerStyle = useMemo((): React.CSSProperties => ({
    background: `linear-gradient(135deg, ${cat.color}33, ${cat.color}11)`,
    borderBottom: `1px solid ${cat.borderColor}44`,
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
  }), [cat.color, cat.borderColor]);

  const varSeparatorStyle = useMemo((): React.CSSProperties => ({
    borderTop: `1px solid ${cat.borderColor}22`, margin: '2px 0',
  }), [cat.borderColor]);

  const paramContainerStyle = useMemo((): React.CSSProperties => ({
    borderTop: `1px solid ${cat.borderColor}33`,
    padding: '6px 10px',
    maxHeight: 200,
    overflowY: 'auto',
  }), [cat.borderColor]);

  const toggleStyle: React.CSSProperties = expanded
    ? { color: '#666', fontSize: 9, transform: 'rotate(180deg)', transition: 'transform 0.2s' }
    : { color: '#666', fontSize: 9, transform: 'rotate(0deg)', transition: 'transform 0.2s' };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 13 }}>{cat.icon}</span>
        <span style={{ fontWeight: 700, color: cat.color, flex: 1 }}>
          {data.className}
        </span>
        <span style={{ color: '#666', fontSize: 9 }}>#{data.nodeIndex}</span>
        <span style={toggleStyle}>▼</span>
      </div>

      {/* Pins */}
      <div style={PINS_WRAP}>
        {Array.from({ length: maxPins }).map((_, i) => {
          const inPin = data.inputPins[i];
          const outPin = data.outputPins[i];
          return (
            <div key={i} style={PIN_ROW_STYLE}>
              <div style={PIN_LEFT_STYLE}>
                {inPin && (
                  <>
                    <Handle type="target" position={Position.Left} id={`in-${inPin.hash}`} style={PIN_STYLE_BLUE} />
                    <span style={IN_LABEL_STYLE}>{inPin.name}</span>
                  </>
                )}
              </div>
              <div style={PIN_RIGHT_STYLE}>
                {outPin && (
                  <>
                    <span style={OUT_LABEL_STYLE}>{outPin.name}</span>
                    <Handle type="source" position={Position.Right} id={`out-${outPin.hash}`} style={PIN_STYLE_ORANGE} />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Variable pins */}
        {data.variablePins.length > 0 && (
          <div style={varSeparatorStyle}>
            {data.variablePins.map((vp, vi) => (
              <div key={vi} style={VAR_ROW_STYLE}>
                <Handle type="target" position={Position.Left} id={`var-${vp.hash}`} style={PIN_STYLE_TEAL_LEFT} />
                <span style={VAR_LABEL_STYLE}>⬢ {vp.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Variable output handle */}
        {isVariableNode && data.inputPins.length === 0 && data.outputPins.length === 0 && (
          <div style={VAR_OUT_WRAP}>
            <Handle type="source" position={Position.Right} id={`var-out-${data.nodeIndex}`} style={PIN_STYLE_TEAL_RIGHT} />
          </div>
        )}
      </div>

      {/* Variable node: always show value inline */}
      {isVariableNode && data.parameters.length > 0 && (
        <div style={{ borderTop: `1px solid ${cat.borderColor}33`, padding: '2px 0' }}>
          {data.parameters.map((param, pi) => (
            <div key={pi} style={VAR_VALUE_STYLE}>
              <span style={VAR_VALUE_NAME_STYLE}>{param._resolvedName ?? '??'}</span>
              <span style={VAR_VALUE_VAL_STYLE}>{param._displayValue ?? '??'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Parameters (only when expanded) */}
      {!isVariableNode && expanded && data.parameters.length > 0 && (
        <div style={paramContainerStyle}>
          <div style={PARAM_HEADER_STYLE}>Parameters</div>
          {data.parameters.map((param, pi) => (
            <ParameterRow key={pi} param={param} />
          ))}
        </div>
      )}
    </div>
  );
});

GSNodeComponent.displayName = 'GSNodeComponent';

const ParameterRow = memo(({ param }: { param: GSData }) => (
  <div style={PARAM_ROW_STYLE}>
    <span style={PARAM_NAME_STYLE}>{param._resolvedName ?? '??'}</span>
    <span style={PARAM_VAL_STYLE}>{param._displayValue ?? '??'}</span>
  </div>
));
ParameterRow.displayName = 'ParameterRow';

export default GSNodeComponent;
