import React from 'react';
import { stackStatus } from './presentation.js';

export default function DeviceStack({ snap, view, t, u }) {
  const layers = stackStatus(snap,t,u,view);
  return <aside className="soft-surface min-w-0 self-start p-4" aria-label={u.stack} data-testid="device-stack">
    <h3 className="mb-3 text-sm font-semibold">{u.stack}</h3>
    <svg viewBox="0 0 260 350" className="mx-auto w-full max-w-72" role="img" aria-label={layers.map(l => l.label+': '+l.value+(l.good ? ' · '+l.detail : '')).reverse().join(' · ')}>
      {[...layers].reverse().map((layer,i) => {
        const y = 12+i*84;
        const color = layer.good ? ['#059669','#0284c7','#8b5cf6','#c18a39'][i] : '#94a3b8';
        return <g key={layer.id} data-layer={layer.id} data-good={String(layer.good)} style={{color,transition:'color 180ms'}}>
          <path d={`M10 ${y+12} L32 ${y} H250 L228 ${y+12} Z`} fill="currentColor" opacity=".16"/>
          <path d={`M228 ${y+12} L250 ${y} V${y+58} L228 ${y+70} Z`} fill="currentColor" opacity=".25"/>
          <rect x="10" y={y+12} width="218" height="58" rx="8" fill="currentColor" fillOpacity={layer.good ? '.12' : '.05'} stroke="currentColor" strokeOpacity=".4"/>
          <circle cx="28" cy={y+34} r="4" fill="currentColor"/>
          <text x="40" y={y+38} fill="currentColor" fontSize="13" fontWeight="600">{layer.label}</text>
          <foreignObject x="24" y={y+43} width="192" height="25"><div className="truncate text-[11px]" title={layer.good ? layer.detail : layer.value}>{layer.good ? layer.detail : layer.value}</div></foreignObject>
        </g>;
      })}
    </svg>
  </aside>;
}
