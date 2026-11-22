import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Download, Plug, Unplug, Usb } from 'lucide-react';
import { consoleCopy } from './copy.js';
import { csvCell, redactExport, targetRows } from './observe.js';
import { presentation, savedConfig } from './presentation.js';
import DeviceStack from './DeviceStack.jsx';
import RadarScene from './RadarScene.jsx';
import ConfigPanels from './ConfigPanels.jsx';
import LiveMetrics from './LiveMetrics.jsx';
import { signalLevel } from './live-metrics.js';
import { wifiProvisionAuth } from './wifi-network.js';

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
      {snap.pending && <Banner>{t.leavePending}</Banner>}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <DeviceStack key={snap.generation} snap={snap} session={session} view={view} t={t} u={u}/>
      <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="step-nav flex-1" style={{gridTemplateColumns: 'repeat(3, 1fr)'}} role="tablist" aria-label={u.title}>
          {['live','config','diag'].map((id) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'current' : ''} onClick={() => setTab(id)}>{t.tabs[id]}</button>)}
        </div>
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
        {tab === 'diag' && <><Wifi key={snap.generation} t={t} u={u} session={session} snap={snap}/><Diag t={t} u={u} session={session} snap={snap} includeNetwork={includeNetwork} setIncludeNetwork={setIncludeNetwork} /></>}
      </div>
      </div></div>
    </div>
  </section>;
}

function Live({ t, u, snap, shown, rows, reading, paused, onPause, onResume, recordState, recording, confirmDiscard, confirmAction, onRecord, onClear, onConfirmDiscard, onClearNow, onConfirmNew, onConfirmClear }) {
  const oneD = rows.some((row) => row.oneD) || (snap.identity && snap.identity.dimension === '1D');
  return <div>
    <div className="mb-4 flex justify-end"><button className="secondary-button" disabled={!shown} onClick={paused ? onResume : onPause}>{paused ? t.resume : t.pause}</button></div>
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
    <div className="mt-4 grid gap-4">
      <div>{oneD && <div className="soft-surface mb-3 p-4"><RangeAxis rows={rows}/></div>}<RadarScene config={savedConfig(snap)} rows={rows} u={u}>
        <LiveMetrics reading={reading} rows={rows} model={snap.identity?.configured_model} language={u === presentation.zh ? 'zh' : 'en'} t={t}/>
      </RadarScene></div>
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

function Wifi({ t, u, session, snap }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [querying, setQuerying] = useState(false);
  const [auth, setAuth] = useState('wpa2_psk');
  const [selected, setSelected] = useState('');
  const sessionKey = String(snap.generation || 0) + ':' + String(snap.bootId || '');
  useEffect(() => {
    setPassword('');
    setSsid('');
    setNotice('');
    setAuth('wpa2_psk');
    setSelected('');
  }, [sessionKey]);
  useEffect(() => {
    if (!snap.sessionLive) return;
    let active = true, timer;
    const refresh = async (attempt = 0) => {
      if (!active) return;
      const result = await session.refreshWifi();
      if (!active) return;
      if (result?.reason === 'rpc_inflight' && attempt < 4) timer = setTimeout(() => refresh(attempt + 1), 500);
      else if (result?.reason === 'rpc_inflight') setNotice(t.wifiRpcBusy);
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [session, sessionKey, snap.sessionLive]);
  const wifi = snap.wifi;
  const task = snap.wifiTask;
  const scan = snap.wifiScan;
  const scanning = scan?.phase === 'scanning';
  const denied = snap.capabilities.some((item) => (item.id === 'wifi' || item.id === 'wifi.status' || item.id === 'wifi.provision') && item.supported === false);
  const unsupported = denied || (wifi && wifi.state === 'unsupported' && wifi.current);
  const locked = task && (task.phase === 'submitting' || task.phase === 'accepted' || task.phase === 'running' || task.phase === 'querying' || (task.phase === 'unknown' && (task.opId || task.jobId)));
  const currentKey = () => {
    const now = session.snapshot ? session.snapshot() : snap;
    return String(now.generation || 0) + ':' + String(now.bootId || '');
  };
  const search = async () => {
    const key = currentKey();
    setNotice('');
    setSelected('');
    setSsid('');
    setPassword('');
    const result = await session.scanWifi();
    if (currentKey() !== key) return;
    if (result && result.reason === 'rpc_inflight') setNotice(t.wifiRpcBusy);
  };
  const submit = async () => {
    if (selected === '' || !['open', 'wpa2_psk'].includes(auth) || locked || scanning) return;
    const key = currentKey();
    const typed = password;
    setNotice('');
    const result = await session.provisionWifi({ ssid, password: auth === 'open' ? '' : typed, auth });
    if (currentKey() !== key) return;
    setPassword('');
    if (!result) return;
    if (result.reason === 'rpc_inflight') setNotice(t.wifiRpcBusy);
    else if (result.reason === 'provision_busy') setNotice(t.wifiBusy);
    else if (result.reason === 'pending_save') setNotice(t.unknownSave);
    else if (result.unknown) setNotice(t.wifiUnknown);
    else if (!result.ok) setNotice(t.wifiFailed + (result.reason ? ' · '+(u.wifiErrors[result.reason] || result.reason) : ''));
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
  const network = wifi?.current && !wifi.historical ? wifi : {};
  const connected = network.state === 'connected';
  const fields = [[u.hardware[3], network.mac_address || snap.identity?.mac_address], [u.hardware[4], connected ? network.ip : null], ['SSID', connected ? network.ssid : null], [u.hardware[6], connected && Number.isFinite(network.rssi_dbm) ? network.rssi_dbm+' dBm' : null]];
  const inProgress = locked && task.phase !== 'unknown';
  return <div className="mb-6 border-b border-slate-200 pb-6 dark:border-white/10" data-testid="network-panel">
    <h3 className="font-semibold">{u.network}</h3>
    <p className="mt-3 text-sm" role="status">{t.wifiState}: {wifi && wifi.current ? (t.wifiStates[wifi.state] || wifi.state) : t.wifiStates.unknown}</p>
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{fields.map(([label,value]) => <div key={label}><dt className="muted text-xs">{label}</dt><dd className="break-all font-medium">{typeof value === 'string' && value.length || Number.isFinite(value) ? value : u.unreported}</dd></div>)}</dl>
    {task && <p className="muted mt-3 text-sm" role="status">{t.wifiTask}: {t.wifiPhases[task.phase] || task.phase}{task.phase === 'unknown' ? ' · ' + t.wifiUnknownNext : ''}{task.reason ? ' · '+(u.wifiErrors[task.reason] || task.reason) : ''}</p>}
    {network.last_error && <p className="notice mt-3" role="status">{t.wifiFailed} · {u.wifiErrors[network.last_error] || network.last_error}</p>}
    {notice && <p className="notice mt-3" role="status">{notice}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="secondary-button" disabled={scanning || locked} onClick={search}>{scanning ? u.scanning : u.scan}</button>
      {task && (task.opId || task.jobId) && task.phase !== 'succeeded' && task.phase !== 'failed' && <button className="secondary-button" disabled={querying} onClick={query}>{t.wifiQuery}</button>}
    </div>
    {scan?.phase === 'failed' && <p className="muted mt-2 text-sm" role="status">{scan.reason === 'UNSUPPORTED' ? u.scanUnsupported : u.scanFailed}</p>}
    {scan?.phase === 'ready' && (scan.items.length ? <fieldset className="mt-4" disabled={Boolean(locked || scanning)}>
      <legend className="mb-2 text-sm font-semibold">{u.scanSelect}</legend>
      <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-1 dark:border-white/10">
        {scan.items.map((item, i) => {
          const provisionAuth = wifiProvisionAuth(item.auth);
          const supported = provisionAuth !== null;
          const level = signalLevel(item.rssi_dbm);
          return <label key={i} className={'flex min-w-0 cursor-pointer items-center gap-3 rounded-lg p-3 ' + (selected === String(i) ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/40' : 'hover:bg-slate-500/10') + (!supported ? ' opacity-50' : '')}>
            <input type="radio" name="console-wifi-network" className="shrink-0 accent-emerald-600" data-testid={'wifi-network-' + i} checked={selected === String(i)} disabled={!supported} onChange={() => { setSelected(String(i)); setSsid(item.ssid); setAuth(provisionAuth); setPassword(''); setNotice(''); }}/>
            <NetworkIcon level={level} secured={item.auth !== 'open'}/>
            <span className="min-w-0 flex-1 break-all text-sm font-medium">{item.ssid}{!supported && <span className="muted block text-xs">{u.scanAuthUnsupported}</span>}</span>
            <span className="muted shrink-0 text-xs tabular-nums">{Number.isFinite(item.rssi_dbm) ? item.rssi_dbm + ' dBm' : '—'}</span>
            <span className="sr-only">{u.signalLevels[level]} · {item.auth === 'open' ? u.open : u.passwordRequired}</span>
          </label>;
        })}
      </div>
    </fieldset> : <p className="muted mt-2 text-sm">{u.scanEmpty}</p>)}
    {selected !== '' && <div className="mt-4" data-testid="wifi-credentials">
      {auth !== 'open' && <label className="block text-sm font-semibold">{t.password}<input className="field mt-2" type="password" disabled={Boolean(locked || scanning)} value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} /></label>}
      <button className="secondary-button mt-3" disabled={Boolean(locked || scanning || !ssid || (auth !== 'open' && !password))} onClick={submit}>{inProgress ? u.provisioning : t.provision}</button>
    </div>}
  </div>;
}

function NetworkIcon({ level, secured }) {
  return <svg viewBox="0 0 32 28" className="h-7 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" data-signal-level={level} data-secured={secured}>
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M2 8a20 20 0 0 1 28 0" opacity={level >= 3 ? 1 : .18}/>
      <path d="M6 13a14 14 0 0 1 20 0" opacity={level >= 2 ? 1 : .18}/>
      <path d="M11 18a7 7 0 0 1 10 0" opacity={level >= 1 ? 1 : .18}/>
    </g>
    <circle cx="16" cy="23" r="1.8" fill="currentColor" opacity={level ? 1 : .18}/>
    {secured && <g stroke="currentColor" strokeWidth="1.4"><rect x="23" y="20" width="8" height="7" rx="1.5" className="fill-slate-50 dark:fill-slate-950"/><path d="M25 20v-2a2 2 0 0 1 4 0v2" fill="none"/></g>}
  </svg>;
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
