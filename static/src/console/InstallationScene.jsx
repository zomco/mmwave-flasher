import React, { useRef, useState } from 'react';
import { clamp, scanVector, svgPoint } from './geometry-editor.js';

const keys = ['install.x_cm','install.y_cm','install.z_cm','install.yaw_deg','install.pitch_deg','install.roll_deg'];
const colors = ['#4285b4','#00866c','#b88736','#8770b7','#b36088'];
const limits = [[-2000,2000],[-2000,2000],[50,600],[-180,180],[-90,90],[-90,90]];
const poly = p => p.map(p=>p.join(',')).join(' ');

export default function InstallationScene({ config, onEdit, writable, feature, locked, u }) {
  const svg = useRef(null), drag = useRef(null);
  const [frozen,setFrozen] = useState(null);
  const values = keys.map(k=>Number.isFinite(config[k])?config[k]:0);
  const [x,y,z,yaw,pitch,roll]=values;
  const scene = frozen || {x0:Math.min(-200,x-150),y0:Math.min(-200,y-150),x1:Math.max(400,x+150),y1:Math.max(400,y+150),z:Math.max(300,z)};
  const k = Math.min(400/(scene.x1-scene.x0+scene.y1-scene.y0),230/(scene.z*.65+200));
  const cx=(scene.x0+scene.x1)/2,cy=(scene.y0+scene.y1)/2;
  const project = ([a,b,c])=>[240+(a-cx-b+cy)*k,270+(a-cx+b-cy)*k*.42-c*k*.65];
  const base=project([x,y,0]),radar=project([x,y,z]);
  const corners=[[scene.x0,scene.y0,0],[scene.x1,scene.y0,0],[scene.x1,scene.y1,0],[scene.x0,scene.y1,0]];
  const scan=(h,v,r=250)=>project(scanVector(yaw,pitch,roll,h,v,r).map((n,i)=>n+[x,y,z][i]));
  const slice = v => [radar,...Array.from({length:19},(_,i)=>scan(-30+i*60/18,v)),radar];
  const handles=[base,[radar[0]-65,radar[1]],[radar[0]+55,radar[1]+35],[radar[0]-25,radar[1]-55],[radar[0]+55,radar[1]-45]];
  const active = mode=>!locked && (mode===0 ? writable(keys[0])&&writable(keys[1]) : writable(keys[mode+1]));
  const apply = (mode,dx,dy,original,scale=k) => {
    if (!active(mode)) return;
    const update=(i,value)=>{
      const spec=feature(keys[i])||{},step=spec.step || [1,1,1,.1,.5,.5][i];
      const min=spec.minimum??limits[i][0],max=spec.maximum??limits[i][1];
      const snapped=min+Math.round((clamp(value,min,max)-min)/step)*step;
      onEdit(keys[i],Number(clamp(snapped,min,max).toFixed(4)));
    };
    if (mode===0) { update(0,original[0]+dx/(2*scale)+dy/(.84*scale)); update(1,original[1]-dx/(2*scale)+dy/(.84*scale)); }
    else if (mode===1) update(2,original[2]-dy/(scale*.65));
    else update(mode+1,original[mode+1]+(mode===3?-dy:dx)*.5);
  };
  const finish=()=>{drag.current=null;setFrozen(null);};
  const start=(e,mode)=>{
    if (!active(mode)||e.button!==0) return;
    const p=svgPoint(svg.current,e);if (!p)return;
    e.preventDefault(); drag.current={mode,p,values:[...values],scale:k,pointer:e.pointerId};setFrozen(scene);svg.current.setPointerCapture(e.pointerId);
  };
  const move=e=>{
    const g=drag.current;if(!g||g.pointer!==e.pointerId)return;
    if (!active(g.mode)) {finish();return;}
    const p=svgPoint(svg.current,e);if(p)apply(g.mode,p.x-g.p.x,p.y-g.p.y,g.values,g.scale);
  };
  const keyboard=(e,mode)=>{
    const delta={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[e.key];
    if(delta&&active(mode)){e.preventDefault();apply(mode,...delta,values);}
  };
  return <figure className="soft-surface overflow-hidden" data-testid="installation-scene">
    <div className="flex flex-wrap gap-2 p-3 text-xs">{values.map((v,i)=><span key={i} className="rounded-full border border-slate-200 px-2 py-1 dark:border-white/10">{u.positions[i]} {v}{i<3?' cm':'°'}</span>)}</div>
    <svg ref={svg} viewBox="0 0 480 400" className="max-h-[420px] w-full touch-none" role="group" aria-label={u.pose} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <polygon points={poly(corners.map(project))} fill="#10b981" fillOpacity=".05" stroke="#059669" strokeOpacity=".5"/>
      {[1,2,3,4].map(i=>{const a=scene.x0+(scene.x1-scene.x0)*i/5,b=scene.y0+(scene.y1-scene.y0)*i/5;return <g key={i} stroke="#059669" strokeOpacity=".13"><polyline points={poly([project([a,scene.y0,0]),project([a,scene.y1,0])])}/><polyline points={poly([project([scene.x0,b,0]),project([scene.x1,b,0])])}/></g>;})}
      {corners.map((p,i)=><polyline key={i} points={poly([project(p),project([p[0],p[1],scene.z])])} fill="none" stroke="currentColor" strokeOpacity=".15" strokeDasharray="4 5"/>)}
      {[-20,0,20].map(v=><polygon key={v} points={poly(slice(v))} fill={v===0?'#10b981':'#38bdf8'} fillOpacity=".07" stroke={v===0?'#059669':'#38bdf8'} strokeOpacity=".5"/>)}
      {[-30,0,30].map(h=><polyline key={h} points={poly(Array.from({length:15},(_,i)=>scan(h,-20+i*40/14)))} fill="none" stroke="#38bdf8" strokeOpacity=".5"/>)}
      <polyline points={poly([base,radar])} stroke="#059669" strokeDasharray="4 4"/>
      <polyline points={poly([radar,scan(0,0,65)])} stroke="#059669" strokeWidth="3"/>
      <polygon points={poly([scan(-70,-45,20),scan(70,-45,20),scan(70,45,20),scan(-70,45,20)])} fill="#059669" stroke="white" strokeWidth="2"/>
      {[corners[1],corners[3]].map((p,i)=>{const q=project(p);return <text key={i} x={q[0]} y={q[1]+18} textAnchor="middle" fontSize="12" fill="currentColor">{i===0?'X':'Y'}</text>;})}
      <text x={project([scene.x0,scene.y0,scene.z])[0]} y={project([scene.x0,scene.y0,scene.z])[1]-10} fill="currentColor" fontSize="12">Z</text>
      {handles.map((p,i)=><g key={i} opacity={active(i)?1:.35}>
        <polyline points={poly([i===0?base:radar,p])} stroke={colors[i]}/>
        <circle cx={p[0]} cy={p[1]} r="11" fill={colors[i]} stroke="white" strokeWidth="2" role="button" tabIndex={active(i)?0:-1} aria-label={u.handles[i]} aria-disabled={!active(i)} data-testid={'pose-handle-'+i} onPointerDown={e=>start(e,i)} onKeyDown={e=>keyboard(e,i)} style={{cursor:active(i)?'grab':'default'}}/>
        <text x={p[0]} y={p[1]-17} textAnchor="middle" fill={colors[i]} fontSize="12" pointerEvents="none">{u.handles[i]}</text>
      </g>)}
    </svg>
    <figcaption className="space-y-1 px-4 pb-4 text-xs"><p>{u.dragPose}</p><p className="muted">{u.coverageHint}</p></figcaption>
  </figure>;
}
