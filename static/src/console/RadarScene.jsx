import React, { useId } from 'react';

const point = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const number = (value) => Number.isFinite(value) ? value : 0;

// Same room convention as mmwave-card: +Y forward at yaw=0, positive yaw toward +X.
export function headingPoint(x, y, yaw, distance) {
  const angle = yaw * Math.PI / 180;
  return [x + distance * Math.sin(angle), y + distance * Math.cos(angle)];
}

export default function RadarScene({ config = {}, rows = [], u, preview = false }) {
  const id = useId().replace(/:/g, '');
  const x = number(config['install.x_cm']);
  const y = number(config['install.y_cm']);
  const yaw = number(config['install.yaw_deg']);
  const boundary = (config['geometry.boundary_cm'] || []).filter(point);
  const areas = (config['areas.definitions'] || []).filter((a) => a.enabled && Array.isArray(a.points_cm));
  const targets = rows.filter((r) => point(r.room));
  // A deliberately labelled orientation sketch, not an invented hardware range specification.
  const radius = 300;
  const head = headingPoint(x, y, yaw, radius);
  const left = headingPoint(x, y, yaw - 30, radius);
  const right = headingPoint(x, y, yaw + 30, radius);
  const points = [[x-60,y-60], [x+60,y+60], head, left, right, ...boundary, ...areas.flatMap((a) => a.points_cm.filter(point)), ...targets.map((r) => r.room)];
  const minX = Math.min(...points.map((p) => p[0])) - 70;
  const maxX = Math.max(...points.map((p) => p[0])) + 70;
  const minY = Math.min(...points.map((p) => p[1])) - 70;
  const maxY = Math.max(...points.map((p) => p[1])) + 70;
  const size = Math.max(maxX-minX, maxY-minY);
  const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
  const scale = size / 480;
  const poly = (list) => list.filter(point).map((p) => p[0] + ',' + -p[1]).join(' ');
  return <figure className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
    <div className="flex items-center justify-between gap-2 px-4 pt-4 text-xs"><span className="font-semibold">{preview ? u.preview : u.scene}</span><span className="muted">{u.room}</span></div>
    <svg viewBox={[cx-size/2, -cy-size/2, size, size].join(' ')} className="aspect-square max-h-[480px] w-full" role="img" aria-label={u.scene} data-testid="radar-scene">
      <defs><pattern id={id+'grid'} width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth={scale} /></pattern></defs>
      <rect x={cx-size/2} y={-cy-size/2} width={size} height={size} fill={'url(#'+id+'grid)'} />
      <path data-testid="coverage-fan" d={'M '+x+' '+-y+' L '+left[0]+' '+-left[1]+' A '+radius+' '+radius+' 0 0 1 '+right[0]+' '+-right[1]+' Z'} fill="#10b981" fillOpacity=".1" stroke="#10b981" strokeOpacity=".45" strokeWidth={1.5*scale} strokeDasharray={6*scale} />
      {[100,200,300].map((r) => {
        const a = headingPoint(x,y,yaw-30,r), b = headingPoint(x,y,yaw+30,r);
        return <path key={r} d={'M '+a[0]+' '+-a[1]+' A '+r+' '+r+' 0 0 1 '+b[0]+' '+-b[1]} fill="none" stroke="#10b981" strokeOpacity=".2" strokeWidth={scale}/>;
      })}
      {boundary.length >= 3 && <polygon data-testid="scene-boundary" points={poly(boundary)} fill="#0ea5e9" fillOpacity=".04" stroke="#0284c7" strokeWidth={2*scale} strokeDasharray={8*scale}/>}
      {areas.map((a) => <g key={a.slot} data-testid="scene-area"><polygon points={poly(a.points_cm)} fill="#8b5cf6" fillOpacity=".09" stroke="#8b5cf6" strokeWidth={1.5*scale}/>{point(a.points_cm[0]) && <text x={a.points_cm[0][0]} y={-a.points_cm[0][1]-10*scale} fill="currentColor" fontSize={13*scale}>{a.name || u.area+' '+(a.slot+1)}</text>}</g>)}
      <line x1={x} y1={-y} x2={head[0]} y2={-head[1]} stroke="#059669" strokeWidth={2*scale}/>
      <g transform={'translate('+x+' '+-y+') rotate('+yaw+')'} data-testid="radar-origin"><path d={'M 0 '+(-24*scale)+' L '+(10*scale)+' '+(-8*scale)+' L '+(-10*scale)+' '+(-8*scale)+' Z'} fill="#059669"/><circle r={7*scale} fill="#059669" stroke="white" strokeWidth={2*scale}/></g>
      <text x={x+16*scale} y={-y+22*scale} fontSize={13*scale} fill="currentColor">{u.radar} · {yaw}°</text>
      {targets.map((r) => <g key={r.key} opacity={r.faded || r.quality !== 'valid' ? .4 : 1}><circle cx={r.room[0]} cy={-r.room[1]} r={9*scale} fill={r.quality === 'valid' ? '#0ea5e9' : '#94a3b8'} stroke="white" strokeWidth={2*scale}/><text x={r.room[0]+14*scale} y={-r.room[1]-10*scale} fontSize={12*scale} fill="currentColor">{u.target} {r.key}</text></g>)}
      <g transform={'translate('+(cx-size/2+24*scale)+' '+(-cy-size/2+60*scale)+')'} fill="currentColor" fontSize={12*scale}><path d="M0 0V-30M0 0H30" fill="none" stroke="currentColor" strokeWidth={scale}/><text x="-7" y="-38">+Y</text><text x="35" y="5">+X</text></g>
    </svg>
    <figcaption className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs dark:border-white/10"><span className="text-emerald-600">● {u.coverage}</span><span className="text-sky-600">● {u.target}</span><span className="text-violet-500">▧ {u.areas}</span><span className="muted w-full">{u.coverageHint}</span></figcaption>
  </figure>;
}
