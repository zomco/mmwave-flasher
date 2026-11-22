import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Circle, Download, Plug, Unplug, Usb } from 'lucide-react';
import { consoleCopy } from './copy.js';
import { checksFromSession, csvCell, redactExport, targetRows } from './observe.js';
import { presentation, savedConfig, stackStatus } from './presentation.js';
import RadarScene from './RadarScene.jsx';
import ConfigPanels from './ConfigPanels.jsx';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Banner({ children }) {
  return <p className="notice mt-4" role="status"><AlertTriangle size={16} aria-hidden="true" /> {children}</p>;
}

export default function ConsoleView({ language, session, snapshot, support, onConnect, onDisconnect, busy, portPhase = 'idle', holdDisconnect = false }) {
  const t = consoleCopy[language] || consoleCopy.en;
  const u = presentation[language] || presentation.en;
  const [tab, setTab] = useState('live');
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [includeNetwork, setIncludeNetwork] = useState(false);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(null);
  /** Recording lifecycle: 'idle' → 'recording' → 'stopped'. */
  const [recordState, setRecordState] = useState('idle');
  const [recording, setRecording] = useState([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  /** Ownership captured at recording start: generation + bootId. */
  const [recordOwner, setRecordOwner] = useState(null);
  /** Telemetry boundary: skip appending the sample that was already visible at start. */
  const recordBoundary = React.useRef(null);
  const snap = snapshot;
  const sim = snap.simulation;

  // A newly established session always opens observation, independently of the installer.
  const connectionKey = snap.layers.protocol === 'online' && snap.sessionLive
    ? String(snap.generation) + ':' + String(snap.sessionId) : null;
  useEffect(() => {
    if (connectionKey) { setTab('live'); setPaused(false); setFrozen(null); }
  }, [connectionKey]);

  // RDE-2: append only when recording is active AND the sample belongs to the
  // owning session. Ownership is checked synchronously before appending; no
  // follow-up effect can retroactively stop after a bad sample entered.
  useEffect(() => {
    if (recordState !== 'recording' || !snap.telemetry) return;
    if (!snap.sessionLive) return;
    if (recordOwner == null) return;
    if (snap.generation !== recordOwner.generation) return;
    if (recordOwner.bootId != null && snap.bootId !== recordOwner.bootId) return;
    // RDE-R2-A: skip the telemetry that was already visible when recording started.
    if (snap.telemetry === recordBoundary.current) return;
    recordBoundary.current = snap.telemetry;
    setRecording((rows) => rows.concat([{ at: Date.now(), body: snap.telemetry }]).slice(-600));
  }, [recordState, snap.telemetry, snap.sessionLive, snap.generation, snap.bootId, recordOwner]);

  // RDE-4: auto-stop on disconnect / generation change / boot change; keep data.
  useEffect(() => {
    if (recordState !== 'recording' || !recordOwner) return;
    if (!snap.sessionLive) setRecordState('stopped');
    else if (snap.generation !== recordOwner.generation) setRecordState('stopped');
    else if (recordOwner.bootId != null && snap.bootId !== recordOwner.bootId) setRecordState('stopped');
  }, [recordState, snap.sessionLive, snap.generation, snap.bootId, recordOwner]);

  useEffect(() => {
    const onHide = (event) => {
      if (snap.pending && event) event.returnValue = t.leavePending;
    };
    window.addEventListener('beforeunload', onHide);
    return () => window.removeEventListener('beforeunload', onHide);
  }, [snap.pending, t.leavePending]);

  useEffect(() => {
    if (!session || typeof session.touchClock !== 'function') return undefined;
    const timer = setInterval(() => session.touchClock(), 1000);
    return () => clearInterval(timer);
  }, [session]);

  const view = session && typeof session.observationView === 'function'
    ? session.observationView()
    : { presence: 'unknown', targets: 'unknown', vitals: 'none', vitalFields: [], live: false, historical: false };
  const checks = useMemo(() => checksFromSession(session), [session, snap]);
  const shown = paused && frozen ? frozen : snap.telemetry;
  const boundary = savedConfig(snap)['geometry.boundary_cm'];
  const display = paused && frozen
    ? { presence: 'paused', targets: 'paused', historical: true, live: false, vitalFields: (view.vitalFields || []).map((field) => ({ ...field, state: 'paused', value: null })) }
    : view;
  const rows = targetRows(shown, boundary).map((row) => (
    !display.live || display.historical || display.targets === 'stale' || display.targets === 'paused'
      ? { ...row, quality: 'stale' }
      : row
  ));

  const connect = async () => {
    setMessage('');
    const result = await onConnect();
    if (result && result.reason === 'chooser_cancelled') setMessage(t.cancelled);
    else if (result && result.reason === 'no_web_serial') setMessage(t.unsupported);
    else if (result && result.reason === 'insecure_context') setMessage(t.insecure);
    else if (result && result.reason === 'installer_holds_port') setMessage(t.installerHold);
    else if (result && (result.reason === 'port_busy' || result.reason === 'peer_holds_port')) setMessage(t.busy);
    else if (result && result.reason === 'timeout') setMessage(t.noResponse);
    else if (result && !result.ok) setMessage(result.reason || t.noResponse);
  };

  /** RDE-3: request clear (goes through confirmation); only when not recording. */
  const clearRecords = () => {
    if (recordState === 'recording') return;
    setConfirmDiscard(true);
    setConfirmAction('clear');
  };

  /** RDE-3: confirm discard and start a new recording in the current session. */
  const confirmNewRecording = () => {
    if (!snap.sessionLive) return;
    recordBoundary.current = snap.telemetry;
    setRecording([]);
    setConfirmDiscard(false);
    setRecordState('recording');
    setRecordOwner({ generation: snap.generation, bootId: snap.bootId });
  };

  /** Start recording (only if session is live); sets owner and boundary. */
  const startRecording = () => {
    if (!snap.sessionLive) return;
    recordBoundary.current = snap.telemetry;
    setRecordState('recording');
    setRecordOwner({ generation: snap.generation, bootId: snap.bootId });
  };

  /** Stop recording; data stays for export. */
  const stopRecording = () => {
    setRecordState('stopped');
  };

  /** RDE-3: confirmed clear (after user confirms via the confirm UI). */
  const confirmClear = () => {
    if (recordState === 'recording') return;
    setRecording([]);
    setConfirmDiscard(false);
    setConfirmAction(null);
    setRecordState('idle');
  };

  const rehandshake = async () => {
    setMessage('');
    if (!session || typeof session.rehandshake !== 'function') return;
    try {
      const result = await session.rehandshake();
      if (result && !result.ok) setMessage(result.reason || t.noResponse);
    } catch (error) {
      setMessage(error && error.message ? error.message : t.noResponse);
    }
  };

  return <section id="console" className="scroll-mt-24 mt-12" aria-label={t.title}>
    <div className="surface p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow"><Usb size={14} aria-hidden="true" />USB</span>
          <h2 className="section-title mt-4">{u.title}</h2>
          <p className="muted mt-3 text-sm">{u.intro}</p>
        </div>
        <div className="flex gap-2">
          {snap.layers.protocol === 'session_expired' && <button className="primary-button" onClick={rehandshake}>{t.rehandshake}</button>}
          {holdDisconnect || snap.layers.port === 'open' || snap.layers.protocol === 'online' || snap.layers.protocol === 'handshake' || snap.layers.protocol === 'session_expired'
            ? <button className="secondary-button" onClick={onDisconnect} disabled={portPhase === 'closing'}><Unplug size={16} />{t.disconnect}</button>
            : <button className="primary-button" onClick={connect} disabled={!support.ok || busy || portPhase === 'installer' || portPhase === 'connecting' || portPhase === 'closing'}><Plug size={16} />{t.connect}</button>}
        </div>
      </div>
      <p className="mt-2 text-sm"><a className="text-link" href={t.guideHref} target="_blank" rel="noreferrer">{t.guide}</a></p>
      {!support.ok && <Banner>{support.reason === 'insecure_context' ? t.insecure : t.unsupported}</Banner>}
      {sim && <Banner>{snap.mode === 'replay' ? t.replayBanner : t.simBanner}</Banner>}
      {snap.layers.protocol === 'handshake' && <p className="notice mt-4" role="status">{t.handshake} {t.waiting}</p>}
      {snap.layers.protocol === 'no_response' && <Banner>{t.noResponse}</Banner>}
      {snap.layers.protocol === 'session_expired' && <Banner>{t.sessionExpired}</Banner>}
      {portPhase === 'installer' && <p className="notice mt-4" role="status">{t.installerHold}</p>}
      {portPhase === 'closing' && <p className="notice mt-4" role="status">{t.closingPort}</p>}
      {portPhase === 'close_failed' && <p className="notice mt-4" role="status">{t.closeFailed}</p>}
      {portPhase === 'installer_unconfirmed' && <p className="notice mt-4" role="status">{t.afterInstaller}</p>}
      {message && <p className="notice mt-4" role="status">{message}</p>}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3" aria-label="USB / MWCP">
        {stackStatus(snap,t,u).map((layer,i) => <div key={layer.label} className="soft-surface min-w-0 p-3 sm:p-4"><div className="muted text-xs">0{i+1} · {layer.label}</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold"><span className={'h-2 w-2 shrink-0 rounded-full '+(layer.good ? 'bg-emerald-500' : 'bg-slate-400')}/>{layer.value}</div><p className="muted mt-2 hidden text-xs sm:block">{layer.detail}</p></div>)}
      </div>
      {snap.identity && <div className="soft-surface mt-4 p-4 text-sm leading-7">
        <div className="font-semibold">{snap.identity.configured_model || '—'} · {snap.identity.dimension || '—'} · {snap.identity.firmware_version || '—'}</div>
      </div>}
      {snap.pending && <Banner>{t.leavePending}</Banner>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="step-nav flex-1" style={{gridTemplateColumns: advanced ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}} role="tablist" aria-label={u.title}>
          {(advanced ? ['live','config','diag'] : ['live','config']).map((id) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'current' : ''} onClick={() => setTab(id)}>{t.tabs[id]}</button>)}
        </div>
        <label className="check-row text-sm"><input type="checkbox" checked={advanced} onChange={(e) => { setAdvanced(e.target.checked); if (!e.target.checked && tab === 'diag') setTab('live'); }}/>{u.advanced}</label>
      </div>
      <div className="mt-6" role="tabpanel">
        {tab === 'live' && !snap.identity && <div className="soft-surface grid min-h-52 place-content-center gap-2 p-8 text-center"><Usb className="mx-auto mb-2 text-brand-600" size={32}/><h3 className="font-semibold">{u.empty}</h3><p className="muted text-sm">{u.emptyHint}</p></div>}
        {tab === 'live' && snap.identity && <Live
    t={t}
    u={u}
    snap={snap}
    shown={shown}
    rows={rows}
    reading={display}
    paused={paused}
    onPause={() => { setFrozen(snap.telemetry); setPaused(true); }}
    onResume={() => setPaused(false)}
    recordState={recordState}
    recording={recording}
    confirmDiscard={confirmDiscard}
    onRecord={() => {
      if (recordState === 'recording') stopRecording();
      else if (confirmDiscard) confirmNewRecording();
      else if (recording.length) { setConfirmDiscard(true); setConfirmAction('newRecording'); }
      else startRecording();
    }}
    onClear={clearRecords}
    confirmAction={confirmAction}
    onConfirmClear={confirmClear}
    onConfirmDiscard={() => { setConfirmDiscard(false); }}
    onClearNow={() => { setRecording([]); setConfirmDiscard(false); setRecordState('idle'); }}
    onConfirmNew={() => confirmNewRecording()}
  />}
        {tab === 'config' && <Config t={t} u={u} session={session} snap={snap} />}
        {tab === 'diag' && advanced && <><Diag t={t} u={u} session={session} snap={snap} includeNetwork={includeNetwork} setIncludeNetwork={setIncludeNetwork} /><details className="soft-surface mt-5 p-4"><summary>{t.tabs.quick}</summary><Quick t={t} checks={checks} reading={view} snap={snap}/></details></>}
      </div>
    </div>
  </section>;
}

function Quick({ t, checks, reading, snap }) {
  const labels = { usb: t.steps.usb, radar: t.steps.radar, presence: t.steps.presence, config: t.steps.config };
  return <div>
    <ul className="mt-4 space-y-3">
      {checks.map((item) => <li key={item.id} className="soft-surface flex items-start justify-between gap-3 p-4">
        <div><div className="font-semibold">{labels[item.id]}</div><div className="muted mt-1 text-xs">{item.id === 'presence' && item.state !== 'present' && item.state !== 'absent' ? t.presenceHint : ''}</div></div>
        <Mark state={item.state} label={t.states[item.state] || item.state} />
      </li>)}
    </ul>
    <p className="muted mt-2 text-xs">{t.states[reading.presence] || reading.presence} · {t.states[reading.targets] || reading.targets}{reading.historical ? ' · ' + t.historical : ''}{snap.telemetry ? ' · seq ' + snap.telemetry.source_seq : ''}</p>
    {reading.live && reading.presence === 'stale' && reading.targets === 'points' && <p className="notice mt-3" role="status">{t.mixedFresh}</p>}
  </div>;
}

function Mark({ state, label }) {
  const good = state === 'pass' || state === 'present' || state === 'absent';
  return <span className={"inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold " + (good ? 'text-brand-700 dark:text-brand-300' : '')}>{good ? <Check size={16} /> : <Circle size={14} />}{label}</span>;
}

function Live({ t, u, snap, shown, rows, reading, paused, onPause, onResume, recordState, recording, confirmDiscard, confirmAction, onRecord, onClear, onConfirmDiscard, onClearNow, onConfirmNew, onConfirmClear }) {
  const oneD = rows.some((row) => row.oneD) || (snap.identity && snap.identity.dimension === '1D');
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="muted text-sm">{t.steps.presence}</span><strong className="text-xl">{t.states[reading.presence] || reading.presence}</strong></div><button className="secondary-button" disabled={!shown} onClick={paused ? onResume : onPause}>{paused ? t.resume : t.pause}</button></div>
    <details className="soft-surface mb-4 p-4"><summary className="cursor-pointer text-sm font-semibold">{u.records} · {recording.length}{recordState === 'recording' ? ' · '+t.recordingActive : ''}</summary>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="secondary-button" disabled={!snap.sessionLive && recordState !== 'recording'} onClick={onRecord}>{recordState === 'recording' ? t.stopRecord : (recording.length ? t.recordNew : t.record)}</button>
      <button className="secondary-button" disabled={!recording.length || recordState === 'recording'} onClick={onClear}>{t.clearRecord}</button>
      <button className="secondary-button" disabled={!recording.length} onClick={() => download('mmwave-observations.jsonl', recording.map((row) => JSON.stringify(redactExport(row))).join('\n'), 'application/x-ndjson')}><Download size={16} />{t.exportJson}</button>
      <button className="secondary-button" disabled={!recording.length} onClick={() => download('mmwave-observations.csv', toCsv(recording), 'text/csv')}><Download size={16} />{t.exportCsv}</button>
    </div>
    <p className="muted mt-3 text-xs">{recordState === 'recording' ? t.recordingActive : recordState === 'stopped' ? t.recordingStopped : t.recordIdle} · {u.recordHint}</p>
    {confirmDiscard && recording.length > 0 && <div className="notice mt-3" role="status">
      {t.recordDiscardConfirm}
      <button className="secondary-button ml-2" onClick={confirmAction === 'clear' ? onConfirmClear : onConfirmNew}>{confirmAction === 'clear' ? t.recordConfirmClear : t.recordDiscardConfirmNew}</button>
      <button className="secondary-button ml-2" onClick={onClearNow}>{t.recordClearNow}</button>
      <button className="secondary-button ml-2" onClick={onConfirmDiscard}>{t.recordDiscardCancel}</button>
    </div>}
    </details>
    {paused && <p className="notice mt-4" role="status">{t.pausedView}</p>}
    {!paused && reading.historical && <p className="notice mt-4" role="status">{t.historical}</p>}
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div>{oneD && <div className="soft-surface mb-3 p-4"><RangeAxis rows={rows}/></div>}<RadarScene config={savedConfig(snap)} rows={rows} u={u}/></div>
      <div className="space-y-3 text-sm">
        {rows.map((row) => <div key={row.key} className={"soft-surface p-4 " + (row.faded ? 'opacity-60' : '')}>
          <div className="font-semibold">{row.oneD ? row.rangeCm + ' cm' : formatPoint(row.room)}</div>
          <div className="muted mt-1 text-xs">{t.states[row.quality] || row.quality} · sample {row.sampleMs == null ? '—' : row.sampleMs}{row.faded ? ' · ' + t.outside : ''}</div>
        </div>)}
        {!rows.length && <p className="notice">{t.states[reading.targets] || reading.targets}</p>}
        <Vitals t={t} fields={reading.vitalFields} />
      </div>
    </div>
  </div>;
}

function RangeAxis({ rows }) {
  const max = 600;
  return <div>
    <div className="relative mt-8 h-3 rounded-full bg-slate-200 dark:bg-white/20">
      {rows.filter((row) => typeof row.rangeCm === 'number').map((row) => <span key={row.key} className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-brand-300" style={{ left: Math.max(0, Math.min(100, (row.rangeCm / max) * 100)) + '%' }} />)}
    </div>
    <div className="mt-3 flex justify-between text-xs"><span>0</span><span>{max} cm</span></div>
  </div>;
}

function Vitals({ t, fields }) {
  if (!fields || !fields.length) return null;
  return <details className="soft-surface p-4"><summary>{t.vitals}</summary><ul className="mt-3 space-y-2 text-xs">{fields.map((field) => <li key={field.key}>{field.key}: {field.state === 'valid' ? String(field.value) : (t.states[field.state] || field.state)}</li>)}</ul></details>;
}

function formatPoint(point) {
  if (!Array.isArray(point)) return '—';
  return point.map((n) => Number(n).toFixed(0)).join(', ') + ' cm';
}

function toCsv(recording) {
  const header = ['at', 'source_seq', 'origin', 'presence_quality', 'presence_value', 'target_count'].map(csvCell).join(',');
  const lines = recording.map((row) => [row.at, row.body.source_seq, row.body.origin, row.body.presence && row.body.presence.quality, row.body.presence && row.body.presence.value, Array.isArray(row.body.targets) ? row.body.targets.length : ''].map(csvCell).join(','));
  return [header].concat(lines).join('\n');
}

function Config({ t, u, session, snap }) {
  const draft = snap.draft || {};
  const changes = session.localChanges();
  const keys = Object.keys(changes);
  const phase = snap.save.phase;
  const locked = !snap.sessionLive || snap.layers.protocol !== 'online' || phase === 'unknown' || phase === 'committing' || phase === 'validating' || phase === 'reading' || phase === 'recovering';
  const conflicted = phase === 'conflict';
  const readbackBlocked = snap.save.message === 'persisted_readback_failed';
  const run = (work) => { Promise.resolve(work()).catch(() => {}); };
  return <div>
    {!snap.sessionLive && <p className="muted mb-4 text-sm">{u.inactive}</p>}
    {snap.save.phase === 'unknown' && <Banner>{t.unknownSave}</Banner>}
    {snap.save.phase === 'conflict' && <Banner>{t.conflict}</Banner>}
    {snap.save.phase === 'conflict' && <IncomingCompare t={t} draft={draft} incoming={snap.incomingConfig} />}
    {(snap.save.message === 'persisted_and_read_back' || snap.save.message === 'confirmed_by_status') && <p className="notice mt-4" role="status"><Check size={16} /> {t.persisted}</p>}
    {snap.save.message === 'persisted_readback_failed' && <Banner>{t.readbackFailed}</Banner>}
    {(snap.save.message === 'read_disconnected' || snap.save.message === 'config_read_failed') && <Banner>{t.readFailed}</Banner>}
    {snap.save.message === 'readback_diverged' && <Banner>{t.readbackDiverged}</Banner>}
    {snap.identity && <ConfigPanels t={t} u={u} session={session} snap={snap} locked={locked || conflicted}/>}
    <p className="muted mt-4 text-sm" role="status">{u.statusValues[phase] || phase}</p>
    {snap.fieldErrors._form && <p className="notice" role="alert">{snap.fieldErrors._form}</p>}
    {keys.length > 0 && <details className="soft-surface mt-4 p-3"><summary>{t.diff} · {keys.length}</summary><ul className="mt-2 space-y-1 text-sm break-all">{keys.map((key) => <li key={key}><code>{key}</code> → {JSON.stringify(changes[key])}</li>)}</ul></details>}
    <div className="mt-5 flex flex-wrap gap-2">
      <button className="primary-button" onClick={() => run(() => session.commitDraft())} disabled={locked || conflicted || readbackBlocked || keys.length === 0}>{t.save}</button>
      <button className="secondary-button" onClick={() => run(() => session.discardDraft())} disabled={locked || conflicted || keys.length === 0}>{t.discard}</button>
      <button className="secondary-button" onClick={() => run(() => session.reloadFromDevice())} disabled={locked}>{t.reload}</button>
      <details><summary className="secondary-button cursor-pointer">{u.more}</summary><button className="secondary-button mt-2" onClick={() => run(() => session.validateDraft())} disabled={locked || conflicted || keys.length === 0}>{t.validate}</button></details>
      {snap.save.phase === 'unknown' && <>
        <button className="primary-button" onClick={() => session.recoverPending()}>{t.queryStatus}</button>
        <button className="secondary-button" onClick={() => session.abandonPending()}>{t.abandon}</button>
      </>}
    </div>
    {snap.save.phase === 'unknown' && <p className="muted mt-3 text-xs leading-6">{t.abandonHint}</p>}
    <Wifi t={t} session={session} snap={snap} />
  </div>;
}

function IncomingCompare({ t, draft, incoming }) {
  if (!incoming || !Array.isArray(incoming.items)) return null;
  const next = Object.fromEntries(incoming.items.map((item) => [item.key, item.value]));
  const keys = Object.keys(next).filter((key) => JSON.stringify(next[key]) !== JSON.stringify((draft || {})[key])).slice(0, 8);
  if (!keys.length) return null;
  return <div className="mt-3 text-sm">
    <p className="muted">{t.incomingHint}</p>
    <ul className="mt-2 space-y-1">{keys.map((key) => <li key={key}><code>{key}</code> → {JSON.stringify(next[key])}</li>)}</ul>
  </div>;
}

function Wifi({ t, session, snap }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [querying, setQuerying] = useState(false);
  const sessionKey = String(snap.generation || 0) + ':' + String(snap.bootId || '');
  useEffect(() => {
    setPassword('');
    setSsid('');
    setNotice('');
  }, [sessionKey]);
  const wifi = snap.wifi;
  const task = snap.wifiTask;
  const denied = snap.capabilities.some((item) => (item.id === 'wifi' || item.id === 'wifi.status' || item.id === 'wifi.provision') && item.supported === false);
  const unsupported = denied || (wifi && wifi.state === 'unsupported' && wifi.current);
  const locked = task && (task.phase === 'submitting' || task.phase === 'accepted' || task.phase === 'running' || task.phase === 'querying' || (task.phase === 'unknown' && (task.opId || task.jobId)));
  const currentKey = () => {
    const now = session.snapshot ? session.snapshot() : snap;
    return String(now.generation || 0) + ':' + String(now.bootId || '');
  };
  const refresh = async () => {
    const key = currentKey();
    setNotice('');
    const result = await session.refreshWifi();
    if (currentKey() !== key) return;
    if (result && result.reason === 'rpc_inflight') setNotice(t.wifiRpcBusy);
  };
  const submit = async () => {
    const key = currentKey();
    const typed = password;
    setNotice('');
    const result = await session.provisionWifi({ ssid, password: typed });
    if (currentKey() !== key) return;
    setPassword('');
    if (!result) return;
    if (result.reason === 'rpc_inflight') setNotice(t.wifiRpcBusy);
    else if (result.reason === 'provision_busy') setNotice(t.wifiBusy);
    else if (result.reason === 'pending_save') setNotice(t.unknownSave);
    else if (result.unknown) setNotice(t.wifiUnknown);
    else if (!result.ok) setNotice(t.wifiFailed);
    else setNotice(t.wifiAccepted);
  };
  const query = async () => {
    if (querying) return;
    const key = currentKey();
    setQuerying(true);
    setNotice('');
    try { await session.queryWifiTask(); }
    finally { if (currentKey() === key) setQuerying(false); }
  };
  if (!snap.sessionLive) {
    if (wifi && wifi.historical) return <p className="muted mt-6 text-sm">{t.wifiHistorical}</p>;
    return null;
  }
  if (unsupported) return <div className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10"><h3 className="font-semibold">{t.wifiTitle}</h3><p className="muted mt-1 text-sm">{t.wifiUnsupported} {t.wifiFallback}</p></div>;
  const connected = wifi && wifi.current && wifi.state === 'connected';
  return <div className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10">
    <h3 className="font-semibold">{t.wifiTitle}</h3>
    <p className="mt-3 text-sm" role="status">{t.wifiState}: {wifi && wifi.current ? (t.wifiStates[wifi.state] || wifi.state) : t.wifiStates.unknown}{connected && wifi.ip ? ' · ' + wifi.ip : ''}</p>
    {task && <p className="muted mt-1 text-sm">{t.wifiTask}: {t.wifiPhases[task.phase] || task.phase}{task.phase === 'unknown' ? ' · ' + t.wifiUnknownNext : ''}</p>}
    {notice && <p className="notice mt-3" role="status">{notice}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="secondary-button" onClick={refresh}>{t.wifiRefresh}</button>
      {task && (task.opId || task.jobId) && task.phase !== 'succeeded' && task.phase !== 'failed' && <button className="secondary-button" disabled={querying} onClick={query}>{t.wifiQuery}</button>}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">{t.ssid}<input className="field mt-2" value={ssid} autoComplete="off" onChange={(event) => setSsid(event.target.value)} /></label>
      <label className="text-sm font-semibold">{t.password}<input className="field mt-2" type="password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} /></label>
    </div>
    <button className="secondary-button mt-3" disabled={locked} onClick={submit}>{t.provision}</button>
    <JobList t={t} jobs={snap.jobs} />
  </div>;
}

function JobList({ t, jobs }) {
  if (!jobs.length) return null;
  return <ul className="mt-3 space-y-2 text-sm">{jobs.map((job) => <li key={job.job_id}>{job.action_id || job.job_id}: {job.state}{job.verified ? '' : ' · ' + t.jobUnknown}</li>)}</ul>;
}

function Diag({ t, u, session, snap, includeNetwork, setIncludeNetwork }) {
  const status = snap.status || {};
  const counters = status.counters || {};
  return <div>
    <p className="muted text-sm leading-7">{u.diagnosticHint}</p>
    {!snap.sessionLive && snap.status && <p className="notice mt-3">{t.historical}</p>}
    <h3 className="mt-4 font-semibold">{t.health}</h3>
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      {Object.entries(u.metrics).map(([key, [name, help]]) => <div key={key} className="soft-surface p-4"><dt className="font-semibold">{name} <code className="muted ml-2 text-xs">{key}</code></dt><dd className="mt-2 text-lg">{status[key] == null ? '—' : String(status[key])}</dd><dd className="muted mt-2 text-xs leading-5">{help}</dd></div>)}
      {Object.entries(counters).map(([key, value]) => <div key={key} className="soft-surface p-4"><dt className="font-semibold">{u.counters[key]?.[0] || key} <code className="muted ml-2 text-xs">{key}</code></dt><dd className="mt-1 font-semibold">{String(value)}</dd><dd className="muted mt-2 text-xs leading-5">{u.counters[key]?.[1]} {u.counterHint}</dd></div>)}
    </dl>
    <h3 className="mt-6 font-semibold">{t.logs}</h3>
    {!snap.logs.length && <p className="muted mt-2 text-sm">{t.noLogs}</p>}
    <ul className="mt-2 space-y-2 text-sm">{snap.logs.slice(-12).map((entry, index) => <li key={index} className="soft-surface p-3">{entry.level} · {entry.source} · {entry.message}</li>)}</ul>
    <label className="check-row mt-4"><input type="checkbox" checked={includeNetwork} onChange={(event) => setIncludeNetwork(event.target.checked)} />{t.includeNetwork}</label>
    <button className="secondary-button mt-3" onClick={() => download('mmwave-diagnostic.json', JSON.stringify(session.diagnosticExport({ includeNetwork }), null, 2), 'application/json')}><Download size={16} />{t.exportDiag}</button>
  </div>;
}
