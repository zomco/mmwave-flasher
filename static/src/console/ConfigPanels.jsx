import React, { useState } from 'react';
import RadarScene from './RadarScene.jsx';

const fields = [
  ['install.x_cm', 'cm', -2000, 2000, 1], ['install.y_cm', 'cm', -2000, 2000, 1],
  ['install.z_cm', 'cm', 50, 600, 1], ['install.yaw_deg', 'deg', -180, 180, .1],
  ['install.pitch_deg', 'deg', -90, 90, .5], ['install.roll_deg', 'deg', -90, 90, .5],
];
const rectangle = () => [[-100,0],[100,0],[100,200],[-100,200]];
const valueOf = (raw) => raw === '' ? null : Number(raw);

export function PolygonEditor({ u, value, onChange, max = 64 }) {
  const points = Array.isArray(value) ? value : [];
  return <div className="space-y-3">
    <p className="muted text-xs">{u.points}</p>
    <div className="max-h-64 space-y-2 overflow-y-auto">{points.map((p, i) => <div key={i} className="grid grid-cols-[24px_1fr_1fr] items-center gap-2">
      <span className="muted text-xs">{i+1}</span>
      {[0,1].map((axis) => <label key={axis} className="text-xs">{axis === 0 ? 'X' : 'Y'}<input className="field mt-1" type="number" step="1" min="-2000" max="2000" value={p[axis] ?? ''} onChange={(e) => onChange(points.map((q,j) => j === i ? q.map((n,k) => k === axis ? valueOf(e.target.value) : n) : q))}/></label>)}
    </div>)}</div>
    <div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" disabled={points.length >= max} onClick={() => onChange(points.concat([[0,0]]))}>{u.addPoint}</button><button type="button" className="secondary-button" disabled={!points.length} onClick={() => onChange(points.slice(0,-1))}>{u.removePoint}</button></div>
  </div>;
}

export default function ConfigPanels({ t, u, session, snap, locked }) {
  const [panel, setPanel] = useState('pose');
  const draft = snap.draft || {};
  const edit = (key, value) => session.editDraft(key, value);
  const writable = (key) => session.supports(key) && session.feature(key)?.writable === true;
  const areas = Array.isArray(draft['areas.definitions']) ? draft['areas.definitions'] : [];
  const maxAreas = Math.min(3, session.feature('areas.definitions')?.max_items ?? 3);
  const updateArea = (slot, changes) => edit('areas.definitions', areas.map((a) => a.slot === slot ? {...a,...changes} : a));
  const prefix = panel === 'areas' ? 'areas.definitions' : 'geometry.boundary_cm';
  const error = Object.entries(snap.fieldErrors).filter(([key]) => key.startsWith(prefix) || (panel === 'boundary' && key.startsWith('range.window_cm'))).map(([,message]) => message).join(' · ');
  return <>
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={t.tabs.config}>{['pose','boundary','areas'].map((key) => <button key={key} role="tab" aria-selected={panel === key} className={panel === key ? 'primary-button' : 'secondary-button'} onClick={() => setPanel(key)}>{u[key]}</button>)}</div>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <fieldset disabled={locked} className="min-w-0 space-y-4 disabled:opacity-60">
        <legend className="mb-2 font-semibold">{u[panel]}</legend><p className="muted text-sm">{u[panel+'Hint']}</p>
        {panel === 'pose' && <>
          {!fields.some(([key]) => writable(key)) && <p className="muted text-sm">{u.unsupported}</p>}
          <div className="grid grid-cols-2 gap-3">{fields.map(([key, unit, min, max, step], i) => writable(key) && <label key={key} className="text-sm font-semibold">{u.positions[i]} ({t.units[unit]})<input className="field mt-2" type="number" min={min} max={max} step={step} aria-invalid={!!snap.fieldErrors[key]} value={draft[key] ?? ''} onChange={(e) => edit(key,valueOf(e.target.value))}/>{snap.fieldErrors[key] && <span role="alert" className="text-xs text-red-600">{snap.fieldErrors[key]}</span>}</label>)}</div>
          {writable('install.yaw_deg') && <label className="block text-sm">{u.positions[3]} · {draft['install.yaw_deg'] ?? 0}°<input className="mt-3 w-full accent-emerald-600" type="range" min="-180" max="180" step="1" value={draft['install.yaw_deg'] ?? 0} onChange={(e) => edit('install.yaw_deg',Number(e.target.value))}/></label>}
        </>}
        {panel === 'boundary' && <>
          {writable('geometry.boundary_cm') ? <>
            {draft['geometry.boundary_cm'] == null ? <><p className="muted text-sm">{u.noBoundary}</p><button className="secondary-button" onClick={() => edit('geometry.boundary_cm',rectangle())}>{u.addBoundary}</button></> : <><PolygonEditor u={u} value={draft['geometry.boundary_cm']} onChange={(v) => edit('geometry.boundary_cm',v)} max={session.feature('geometry.boundary_cm')?.max_items ?? 64}/><button className="secondary-button" onClick={() => edit('geometry.boundary_cm',null)}>{u.clearBoundary}</button></>}
          </> : <p className="muted text-sm">{u.unsupported}</p>}
          {writable('range.window_cm') && <div className="grid grid-cols-2 gap-3">{['min','max'].map((key) => <label key={key}>{t.range} · {key}<input className="field mt-2" type="number" value={draft['range.window_cm']?.[key] ?? ''} onChange={(e) => edit('range.window_cm',{...draft['range.window_cm'],[key]:valueOf(e.target.value)})}/></label>)}</div>}
        </>}
        {panel === 'areas' && (writable('areas.definitions') ? <>
          {!areas.length && <p className="muted text-sm">{u.noAreas}</p>}
          {areas.map((a) => <div className="soft-surface space-y-3 p-4" key={a.slot}>
            <label className="check-row"><input type="checkbox" checked={a.enabled} onChange={(e) => updateArea(a.slot,{enabled:e.target.checked})}/>{u.area} {a.slot+1} · {u.enabled}</label>
            <label className="block text-sm">{u.name}<input className="field mt-2" value={a.name} onChange={(e) => updateArea(a.slot,{name:e.target.value})}/></label>
            <PolygonEditor u={u} value={a.points_cm} max={12} onChange={(v) => updateArea(a.slot,{points_cm:v})}/>
            <button className="secondary-button" onClick={() => edit('areas.definitions',areas.filter((n) => n.slot !== a.slot))}>{u.removeArea}</button>
          </div>)}
          <button className="secondary-button" disabled={areas.length >= maxAreas} onClick={() => { const slot = Array.from({length:maxAreas},(_,i) => i).find((i) => !areas.some((a) => a.slot === i)); if (slot != null) edit('areas.definitions',areas.concat([{slot,enabled:true,name:u.area+' '+(slot+1),points_cm:rectangle()}])); }}>{u.addArea}</button>
          <p className="muted text-xs">{u.areaStatus}</p>
        </> : <p className="muted text-sm">{u.unsupported}</p>)}
        {panel !== 'pose' && error && <p role="alert" className="text-sm text-red-600">{t.fieldError}: {error}</p>}
      </fieldset>
      <RadarScene config={draft} u={u} preview={Object.keys(session.localChanges()).length > 0}/>
    </div>
  </>;
}
