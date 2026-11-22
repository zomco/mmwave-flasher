import React, { useId, useRef, useState } from 'react';
import { isPoint as point, headingPoint, polygonBounds, editPolygon, svgPoint } from './geometry-editor.js';
export { headingPoint } from './geometry-editor.js';
const number = (v) => Number.isFinite(v) ? v : 0;

export default function RadarScene({ config = {}, rows = [], u, preview = false, editable = null, onPolygonChange, locked = false, children }) {
  const id = useId().replace(/:/g, '');
  const svg = useRef(null), gesture = useRef(null);
  const [frozenBounds, setFrozenBounds] = useState(null);
  const x = number(config['install.x_cm']), y = number(config['install.y_cm']), yaw = number(config['install.yaw_deg']);
  const boundary = (config['geometry.boundary_cm'] || []).filter(point);
  const areas = (config['areas.definitions'] || []).filter(a => (a.enabled || editable?.slot === a.slot) && Array.isArray(a.points_cm));
  const targets = rows.filter(r => point(r.room));
  const radius = 300; // Orientation illustration; never presented as a measured model FOV.
  const head = headingPoint(x,y,yaw,radius), left = headingPoint(x,y,yaw-30,radius), right = headingPoint(x,y,yaw+30,radius);
  const points = [[x-60,y-60],[x+60,y+60],head,left,right,...boundary,...areas.flatMap(a=>a.points_cm.filter(point)),...targets.map(r=>r.room)];
  const bounds = frozenBounds || polygonBounds(points);
  const [minX,minY,maxX,maxY] = bounds;
  const size = Math.max(maxX-minX,maxY-minY)+140, cx=(minX+maxX)/2, cy=(minY+maxY)/2, scale=size/480;
  const unit = 10 ** Math.floor(Math.log10(size / 5));
  const ruler = [5,2,1].map(n => n*unit).find(n => n <= size/5);
  const distance = cm => cm >= 100 ? `${Number((cm/100).toFixed(2))} m` : `${cm} cm`;
  const poly = list => list.filter(point).map(p=>p.join(',')).join(' ');
  const selected = editable?.kind === 'boundary' ? config['geometry.boundary_cm'] || [] : areas.find(a=>a.slot===editable?.slot)?.points_cm || [];
  const canEdit = !locked && !!onPolygonChange && selected.length >= 3 && selected.every(point);
  const finish = () => { gesture.current=null; setFrozenBounds(null); };
  const start = (event,mode,index) => {
    if (!canEdit || event.button !== 0) return;
    const p=svgPoint(svg.current,event); if (!p) return;
    event.preventDefault(); event.stopPropagation();
    gesture.current={mode,index,p,points:selected.map(p=>[...p]),pointer:event.pointerId};
    setFrozenBounds(bounds); svg.current.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const g=gesture.current; if (!g || event.pointerId!==g.pointer) return;
    if (!canEdit) { finish(); return; }
    const p=svgPoint(svg.current,event); if (p) onPolygonChange(editPolygon(g.points,g.mode,g.index,p.x-g.p.x,p.y-g.p.y));
  };
  const keys = (event,mode,index) => {
    const delta={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]}[event.key];
    if (delta && canEdit) { event.preventDefault(); onPolygonChange(editPolygon(selected,mode,index,...delta)); }
  };
  const handle = (mode,index,label) => ({role:'button',tabIndex:0,'aria-label':label,onPointerDown:e=>start(e,mode,index),onKeyDown:e=>keys(e,mode,index),style:{cursor:mode==='move'?'move':'nwse-resize'}});
  const selectedBounds = canEdit ? polygonBounds(selected) : null;
  return <figure className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 text-xs"><span className="font-semibold">{preview ? u.preview : u.scene}</span><span className="muted">{u.room}</span></div>
    <svg ref={svg} viewBox={[cx-size/2,cy-size/2,size,size].join(' ')} className="aspect-square max-h-[480px] w-full" style={{touchAction:canEdit?'none':'auto'}} role={editable?'group':'img'} aria-label={u.scene} data-testid="radar-scene" onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <defs><pattern id={id+'grid'} width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth={scale}/></pattern></defs>
      <rect x={cx-size/2} y={cy-size/2} width={size} height={size} fill={'url(#'+id+'grid)'}/>
      <path data-testid="coverage-fan" d={`M ${x} ${y} L ${left.join(' ')} A ${radius} ${radius} 0 0 0 ${right.join(' ')} Z`} fill="#10b981" fillOpacity=".1" stroke="#10b981" strokeOpacity=".45" strokeWidth={1.5*scale} strokeDasharray={6*scale}/>
      {[100,200,300].map(r=>{const a=headingPoint(x,y,yaw-30,r),b=headingPoint(x,y,yaw+30,r);return <g key={r} pointerEvents="none"><path d={`M ${a.join(' ')} A ${r} ${r} 0 0 0 ${b.join(' ')}`} fill="none" stroke="#10b981" strokeOpacity=".2" strokeWidth={scale}/><text x={b[0]+8*scale} y={b[1]+4*scale} fill="currentColor" fontSize={12*scale} data-testid="range-label">{distance(r)}</text></g>;})}
      {boundary.length>=3 && <polygon data-testid="scene-boundary" points={poly(boundary)} fill="#0ea5e9" fillOpacity=".04" stroke="#0284c7" strokeWidth={2*scale} strokeDasharray={8*scale}/>}
      {areas.map(a=><g key={a.slot} data-testid="scene-area" opacity={a.enabled?1:.4}><polygon points={poly(a.points_cm)} fill="#8b5cf6" fillOpacity=".09" stroke="#8b5cf6" strokeWidth={1.5*scale}/>{point(a.points_cm[0])&&<text x={a.points_cm[0][0]} y={a.points_cm[0][1]-10*scale} fill="currentColor" fontSize={13*scale}>{a.name||u.area+' '+(a.slot+1)}</text>}</g>)}
      <line x1={x} y1={y} x2={head[0]} y2={head[1]} stroke="#059669" strokeWidth={2*scale}/>
      <g transform={`translate(${x} ${y}) rotate(${-yaw})`} data-testid="radar-origin"><path d={`M 0 ${24*scale} L ${10*scale} ${8*scale} L ${-10*scale} ${8*scale} Z`} fill="#059669"/><circle r={7*scale} fill="#059669" stroke="white" strokeWidth={2*scale}/></g>
      <text x={x+16*scale} y={y-16*scale} fontSize={13*scale} fill="currentColor">{u.radar} · {yaw}°</text>
      {targets.map(r=><g key={r.key} opacity={r.faded||r.quality!=='valid'?.4:1}><circle data-testid="scene-target" cx={r.room[0]} cy={r.room[1]} r={9*scale} fill={r.quality==='valid'?'#0ea5e9':'#94a3b8'} stroke="white" strokeWidth={2*scale}/><text x={r.room[0]+14*scale} y={r.room[1]-10*scale} fontSize={12*scale} fill="currentColor">{u.target} {r.key}</text></g>)}
      {canEdit && <g data-testid="polygon-controls">
        <polygon points={poly(selected)} fill="#0284c7" fillOpacity=".06" stroke="#0284c7" strokeWidth={2*scale} {...handle('move',null,u.move)} data-testid="polygon-move"/>
        {selected.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={7*scale} fill="white" stroke="#0284c7" strokeWidth={2*scale} {...handle('vertex',i,u.vertex+' '+(i+1))} data-testid={'polygon-vertex-'+i}/>)}
        <path d={`M ${selectedBounds[2]} ${selectedBounds[3]} l ${20*scale} ${20*scale}`} stroke="#0284c7" strokeWidth={scale}/>
        <rect x={selectedBounds[2]+14*scale} y={selectedBounds[3]+14*scale} width={12*scale} height={12*scale} fill="#0284c7" stroke="white" strokeWidth={scale} {...handle('resize',null,u.resize)} data-testid="polygon-resize"/>
      </g>}
      <g transform={`translate(${cx-size/2+24*scale} ${cy-size/2+24*scale}) scale(${scale})`} fill="currentColor" fontSize="12"><path d="M0 30V0H30" fill="none" stroke="currentColor"/><text x="-7" y="45">Y ↓</text><text x="35" y="4">X →</text></g>
      <g transform={`translate(${cx-size/2+24*scale} ${cy+size/2-26*scale})`} pointerEvents="none" data-testid="distance-scale" data-length-cm={ruler} fill="currentColor">
        <rect x={-10*scale} y={-24*scale} width={ruler+20*scale} height={40*scale} rx={6*scale} className="fill-slate-50 dark:fill-slate-950" opacity=".92"/>
        <path d={`M0 ${-5*scale} V0 H${ruler} V${-5*scale}`} fill="none" stroke="currentColor" strokeWidth={2*scale}/>
        <text x={ruler/2} y={-9*scale} textAnchor="middle" fontSize={12*scale}>{distance(ruler)}</text>
      </g>
    </svg>
    {children}
    <figcaption className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs dark:border-white/10"><span className="text-emerald-600">● {u.coverage}</span><span className="text-sky-600">● {u.target}</span><span className="text-violet-500">▧ {u.areas}</span><span className="muted w-full">{editable?u.dragShape:u.coverageHint}</span></figcaption>
  </figure>;
}
