import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, killProcessTree, launchBrowser } from '../browser-harness.js';
import { connectCdp, waitForText } from '../cdp-client.js';

const root = fileURLToPath(new URL('../..', import.meta.url));

test('browser page clicks config and shows stale data on the simulated console', async () => {
  const executable = findBrowser();
  assert.ok(executable, 'set MWCP_CHROME or install Chrome/Chromium');
  const outDir = mkdtempSync(join(tmpdir(), 'mwcp-console-'));
  await runBounded(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), 'build', '--config', 'vite.console.config.js'], {
    cwd: root,
    env: { ...process.env, MWCP_CONSOLE_OUT: outDir },
    timeoutMs: 20000,
  });
  const server = await serve(outDir);
  const debugPort = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'mwcp-console-chrome-'));
  let browser = null;
  let socket = null;
  try {
    browser = await launchBrowser({
      executable,
      timeoutMs: 5000,
      args: [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        `--user-data-dir=${profile}`,
        `--remote-debugging-port=${debugPort}`,
        '--remote-allow-origins=*',
        `http://127.0.0.1:${server.port}/console-browser.html`,
      ],
    });
    const page = await waitPage(debugPort, 5000);
    socket = connectCdp(page.webSocketDebuggerUrl, { openTimeoutMs: 3000, commandTimeoutMs: 1000 });
    await socket.send('Runtime.enable');
    await socket.send('Emulation.setDeviceMetricsOverride', {width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    try {
      await waitForText(socket, { timeoutMs: 8000, commandTimeoutMs: 1000, match: '连接设备' });
    } catch (error) {
      const diag = await evaluate(socket, `(() => ({
        text: document.body ? document.body.innerText.slice(0, 400) : '',
        resources: performance.getEntriesByType('resource').map((item) => item.name),
      }))()`).catch((diagError) => String(diagError));
      throw new Error(String(error && error.message || error) + '\n' + JSON.stringify(diag));
    }
    const empty = await evaluate(socket, `({
      tabs: [...document.querySelectorAll('[role="tab"]')].map((el) => el.textContent),
      scene: !!document.querySelector('[data-testid="radar-scene"]'),
      text: document.body.innerText,
    })`);
    assert.deepEqual(empty.tabs, ['实时数据','配置','诊断']);
    assert.equal(empty.scene, false);
    assert.doesNotMatch(empty.text, /无体征|configured_model|当前承诺的真机组合/);
    assert.match(empty.text, /串口层/);
    assert.match(empty.text, /协议层/);
    assert.match(empty.text, /主控层/);
    assert.match(empty.text, /雷达层/);
    await click(socket, '配置');
    await click(socket, '连接设备');
    const connected = await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: '模拟模式' });
    assert.match(connected, /MWCP 1\.0/);
    assert.doesNotMatch(connected, /烧录成功/);
    await waitForText(socket, {timeoutMs:5000, commandTimeoutMs:1000, match:'观测记录与导出'});
    assert.equal(await evaluate(socket, `document.querySelector('[role="tab"][aria-selected="true"]').textContent`), '实时数据');
    assert.equal(await evaluate(socket, `!!document.querySelector('[data-testid="coverage-fan"]') && !!document.querySelector('[data-testid="radar-origin"]')`), true);
    await click(socket, '诊断');
    assert.match(await evaluate(socket, 'document.body.innerText'), /自本次启动起的毫秒数/);
    await click(socket, '实时数据');
    assert.equal(await evaluate(socket, `document.querySelector('[role="tab"][aria-selected="true"]').textContent`), '实时数据');
    await click(socket, '配置');
    await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '方向校准' });
    await screenshot(socket, 'installation-desktop');
    const beforePose = await evaluate(socket, `window.__mwcp.session.draft['install.z_cm']`);
    await dragHandle(socket,'pose-handle-1',0,-16);
    assert.ok(await evaluate(socket, `window.__mwcp.session.draft['install.z_cm']`) > beforePose);
    assert.equal(await evaluate(socket, `window.__mwcp.device.config['install.z_cm']`),beforePose,'drag must not persist before Save');
    await evaluate(socket, `document.querySelector('[data-testid="installation-scene"]').nextElementSibling.querySelector('details').open=true`);
    const edited = await evaluate(socket, `(() => new Promise((resolve) => {
      const deadline = Date.now() + 3000;
      const tick = () => {
        const input = document.querySelector('#console input.field');
        if (!input) {
          if (Date.now() > deadline) resolve('missing-input');
          else setTimeout(tick, 20);
          return;
        }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '31');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        resolve('edited');
      };
      tick();
    }))()`);
    assert.equal(edited, 'edited');
    await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '将写入的变化' });
    await click(socket, '在设备上验证');
    const validated = await evaluate(socket, `(() => new Promise((resolve) => {
      const deadline = Date.now() + 3000;
      const tick = () => {
        const message = window.__mwcp.session.save.message;
        if (message === 'validated') resolve('validated');
        else if (Date.now() > deadline) resolve(String(message));
        else setTimeout(tick, 20);
      };
      tick();
    }))()`);
    assert.equal(validated, 'validated');
    await click(socket, '保存到设备');
    const saved = await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: '已保存并读回' });
    assert.match(saved, /模拟模式/);
    assert.doesNotMatch(saved, /烧录成功/);
    await click(socket, '边界过滤');
    // Firmware polygon contracts use [x,y] pairs, not {x,y} objects.
    await evaluate(socket, `window.__mwcp.session.editDraft('geometry.boundary_cm', null)`);
    await click(socket, '添加矩形边界');
    assert.deepEqual(await evaluate(socket, `window.__mwcp.session.localChanges()['geometry.boundary_cm']`), [[-100,0],[100,0],[100,200],[-100,200]]);
    assert.equal(await evaluate(socket, `!!document.querySelector('[data-testid="scene-boundary"]')`), true);
    await dragHandle(socket,'polygon-vertex-0',12,15);
    const draggedBoundary=await evaluate(socket, `window.__mwcp.session.draft['geometry.boundary_cm']`);
    assert.ok(draggedBoundary[0][0]>-100 && draggedBoundary[0][1]>0,'screen right/down means world +X/+Y');
    await dragHandle(socket,'polygon-resize',15,15);
    const resizedBoundary=await evaluate(socket, `window.__mwcp.session.draft['geometry.boundary_cm']`);
    assert.ok(resizedBoundary[2][0]>draggedBoundary[2][0] && resizedBoundary[2][1]>draggedBoundary[2][1]);
    await screenshot(socket, 'boundary-desktop');
    await click(socket, '区域占用');
    await click(socket, '添加区域');
    const areaDraft = await evaluate(socket, `window.__mwcp.session.localChanges()['areas.definitions'][0]`);
    assert.equal(areaDraft.slot, 0);
    assert.equal(areaDraft.enabled, true);
    assert.deepEqual(areaDraft.points_cm, [[-100,0],[100,0],[100,200],[-100,200]]);
    await dragHandle(socket,'polygon-move',15,10);
    const movedArea=await evaluate(socket, `window.__mwcp.session.draft['areas.definitions'][0]`);
    assert.ok(movedArea.points_cm[0][0]>areaDraft.points_cm[0][0]);
    assert.equal(movedArea.points_cm[1][0]-movedArea.points_cm[0][0],200);
    await click(socket, '保存到设备');
    await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: '已保存并读回' });
    assert.deepEqual(await evaluate(socket, `window.__mwcp.device.config['areas.definitions'][0]`), movedArea);
    await click(socket, '方向校准');
    await evaluate(socket, `window.__mwcp.device.emitTelemetry(window.__mwcp.observation('zero'))`);
    await click(socket, '实时数据');
    const freshLive = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '报告有人' });
    assert.match(freshLive, /报告有人/);
    assert.match(freshLive, /R60ABD1/);
    assert.equal(await evaluate(socket, `document.querySelectorAll('[data-testid="range-label"]').length`),3);
    assert.ok(await evaluate(socket, `Number(document.querySelector('[data-testid="distance-scale"]').dataset.lengthCm)>0`));
    await evaluate(socket, `(() => {
      const now = window.__mwcp.clock.now(); const sent = now + 20000;
      window.__mwcp.device.emitTelemetry({
        source_seq: 90,
        sent_ms: sent,
        presence: { value: true, quality: 'valid', sample_ms: now },
        targets_quality: 'valid',
        targets_ms: sent,
        targets: [{ id: '0', local_cm: [12, 34], room_cm: [12, 34], position_quality: 'valid', position_ms: sent, boundary: 'inside', speed_cm_s: null }],
      });
      window.__mwcp.session.touchClock();
      return window.__mwcp.session.layers.radar;
    })()`);
    await click(socket, '实时数据');
    const mixedLive = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '12, 34' });
    assert.match(mixedLive, /方向校准后的坐标 · 有效/);
    assert.match(mixedLive, /已过期/);
    assert.doesNotMatch(mixedLive, /报告有人/);
    await evaluate(socket, `(() => { window.__mwcp.clock.advance(9001); window.__mwcp.session.touchClock(); return window.__mwcp.session.observationView().presence; })()`);
    const staleLive = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '已过期' });
    assert.doesNotMatch(staleLive, /\bvalid\b/);
    await evaluate(socket, `window.__mwcp.device.emitTelemetry(window.__mwcp.observation('zero'))`);
    const restored = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '报告有人' });
    assert.doesNotMatch(restored, /已过期/);
    await evaluate(socket, `(() => {
      const body = window.__mwcp.observation('zero');
      const sample_ms = body.sent_ms;
      body.metrics = Object.fromEntries([
        ['distance.cm',120,'valid'], ['breath_rate',18,'valid'], ['heart_rate',72,'valid'],
        ['diagnostics.local_z',0,'valid'], ['speed.cm_s',null,'unsupported'],
        ['motion.state',null,'unknown'], ['body.movement',0,'valid'],
        ['sleep.state',null,'unknown'], ['areas.occupancy',null,'unknown'],
      ].map(([key,value,quality])=>[key,{value,quality,sample_ms}]));
      window.__mwcp.device.emitTelemetry(body);
    })()`);
    await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '呼吸频率' });
    assert.equal(await evaluate(socket, `!!document.querySelector('figure [data-testid="live-metrics"]')`), true);
    const metricsText = await evaluate(socket, `document.querySelector('[data-testid="live-metrics"]').textContent`);
    assert.match(metricsText, /呼吸频率18 次\/分/);
    assert.match(metricsText, /体动幅度0/);
    assert.doesNotMatch(metricsText, /breath_rate|heart_rate/);
    assert.match(await evaluate(socket, `document.querySelector('[data-testid="metrics-enhanced"]').textContent`), /区域占用/);
    await click(socket, '诊断');
    const wifiPanel = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '网络与配网' });
    assert.match(wifiPanel, /SSID/);
    assert.doesNotMatch(wifiPanel, /快速验证|读取网络|读取设备信息|工作频段|信道/);
    await socket.send('Emulation.setDeviceMetricsOverride', {width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    await screenshot(socket, 'config-desktop');
    await click(socket, '实时数据');
    await screenshot(socket, 'live-desktop');
    await socket.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await screenshot(socket, 'live-mobile');
    assert.equal(await evaluate(socket, 'document.documentElement.scrollWidth <= 390'), true, 'live view must fit mobile width');
    await click(socket, '配置');
    await click(socket, '区域占用');
    await screenshot(socket, 'areas-mobile');
    assert.equal(await evaluate(socket, 'document.documentElement.scrollWidth <= 390'), true, 'area editor must fit mobile width');
    await evaluate(socket, `document.documentElement.classList.add('dark')`);
    await screenshot(socket, 'areas-mobile-dark');
    await evaluate(socket, `document.documentElement.classList.remove('dark')`);
    await socket.send('Emulation.setDeviceMetricsOverride', {width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    await click(socket, '诊断');
    await evaluate(socket, `(() => {
      const device=window.__mwcp.device;
      // Match the real ESPHome adapter: authenticated networks report unknown.
      device.scanItems=[{ssid:'Lab',rssi_dbm:-40,auth:'unknown',hidden:false},{ssid:'Guest',rssi_dbm:-65,auth:'open',hidden:false}];
      const scan=device.wifiScan.bind(device);
      device.wifiScan=(...args)=>{const reply=scan(...args); if(reply.ok) device.advanceJob(reply.result.job_id,'succeeded'); return reply;};
      return true;
    })()`);
    await click(socket, '搜索 SSID');
    await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: '选择搜索到的网络' });
    assert.equal(await evaluate(socket, `document.querySelector('[data-testid="wifi-network-0"]').disabled`), false);
    assert.doesNotMatch(await evaluate(socket, `document.querySelector('[data-testid="network-panel"]').textContent`), /暂不支持此安全类型/);
    assert.equal(await evaluate(socket, `window.__mwcp.session.snapshot().wifiScan.items[0].auth`), 'unknown', 'raw scan auth must remain unchanged');
    assert.equal(await evaluate(socket, `!!document.querySelector('[data-testid="wifi-credentials"]')`), false);
    assert.equal(await evaluate(socket, `document.querySelectorAll('[data-testid="network-panel"] select, [data-testid="network-panel"] input:not([type="radio"])').length`), 0);
    assert.deepEqual(await evaluate(socket, `[...document.querySelectorAll('[data-signal-level]')].map(el=>[el.dataset.signalLevel,el.dataset.secured])`), [['3','true'],['2','false']]);
    await evaluate(socket, `document.querySelector('[data-testid="wifi-network-1"]').click()`);
    assert.equal(await evaluate(socket, `document.querySelectorAll('[data-testid="wifi-credentials"] input').length`), 0, 'open networks need no password');
    assert.equal(await evaluate(socket, `[...document.querySelectorAll('button')].find(b=>b.textContent==='提交配网').disabled`), false);
    await evaluate(socket, `document.querySelector('[data-testid="wifi-network-0"]').click()`);
    assert.equal(await evaluate(socket, `[...document.querySelectorAll('button')].find(b=>b.textContent==='提交配网').disabled`), true, 'secured network waits for password');
    await click(socket, '搜索 SSID');
    assert.equal(await evaluate(socket, `!!document.querySelector('[data-testid="wifi-credentials"]')`), false, 'rescan clears selection');
    await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: '选择搜索到的网络' });
    await evaluate(socket, `document.querySelector('[data-testid="wifi-network-0"]').click()`);
    await evaluate(socket, `(() => {
      const password = [...document.querySelectorAll('label')].find((el) => el.textContent.trim() === '密码').querySelector('input');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(password, 'lab-pass-1');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      return 'filled';
    })()`);
    await click(socket, '提交配网');
    const accepted = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '已受理' });
    assert.doesNotMatch(accepted, /已联网/);
    assert.equal(await evaluate(socket, `[...document.querySelectorAll('button')].find(b=>b.textContent==='配网中…')?.disabled`),true);
    await click(socket, '查询原任务');
    const queried = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '已受理' });
    assert.match(queried, /已受理|处理中/);
    await evaluate(socket, `(() => {
      const job = [...window.__mwcp.device.activeJobs.values()].find(j=>j.action_id==='wifi.provision');
      job.state = 'succeeded';
      window.__mwcp.device.wifi = { state: 'connected', ssid: 'Lab', ip: '192.168.1.50', rssi_dbm: -40, last_error: null, mac_address:'00:11:22:33:44:55', band:'2.4 GHz', channel:6 };
      return 'ready';
    })()`);
    const wifiLink = await waitForText(socket, { timeoutMs: 4000, commandTimeoutMs: 1000, match: '192.168.1.50' });
    assert.match(wifiLink, /已联网/);
    assert.match(wifiLink, /00:11:22:33:44:55/);
    assert.doesNotMatch(wifiLink, /工作频段|信道|2\.4 GHz/);
    await screenshot(socket, 'network-connected-desktop');
    await socket.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await screenshot(socket, 'network-connected-mobile');
    assert.equal(await evaluate(socket, 'document.documentElement.scrollWidth <= 390'),true);
    await socket.send('Emulation.setDeviceMetricsOverride', {width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    assert.doesNotMatch(wifiLink, /lab-pass-1/);
    await evaluate(socket, `(() => {
      const password = [...document.querySelectorAll('label')].find((el) => el.textContent.trim() === '密码').querySelector('input');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(password, 'lab-pass-1');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      return password.value;
    })()`);
    await evaluate(socket, '(() => { window.__mwcp.session.rpcAt = Array(8).fill(window.__mwcp.clock.now()); })()');
    const stuck = evaluate(socket, `(() => {
      const password = [...document.querySelectorAll('label')].find((el) => el.textContent.trim() === '密码').querySelector('input');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(password, 'lab-pass-1');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('button')].find((el) => el.textContent.includes('提交配网')).click();
      return 'submitted';
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await click(socket, '断开');
    await evaluate(socket, 'window.__mwcp.device.reboot()');
    await evaluate(socket, '(() => { window.__mwcp.session.rpcAt = []; })()');
    await click(socket, '连接设备');
    await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: 'MWCP 1.0' });
    const leaked = await evaluate(socket, `(() => {
      let provisions = 0;
      window.__mwcp.device.dispatch = ((original) => (frame, now) => {
        if (frame.code === 0x0052) provisions += 1;
        return original(frame, now);
      })(window.__mwcp.device.dispatch.bind(window.__mwcp.device));
      window.__mwcp.__provisionCount = () => provisions;
      return provisions;
    })()`);
    assert.equal(leaked, 0, 'old credentials must not reach the new session');
    await stuck;
    await click(socket, '断开');
    await evaluate(socket, 'window.__mwcp.device.reboot()');
    await click(socket, '连接设备');
    await waitForText(socket, { timeoutMs: 5000, commandTimeoutMs: 1000, match: 'MWCP 1.0' });
    await click(socket, '诊断');
    const cleared = await evaluate(socket, `(() => { const password = [...document.querySelectorAll('label')].find((el) => el.textContent.trim() === '密码'); return password ? password.querySelector('input').value : 'gone'; })()`);
    assert.equal(cleared, 'gone');
    await click(socket, '配置');
    await evaluate(socket, `window.__mwcp.device.faults.delayMs = 60000`);
    await click(socket, '重新读取设备');
    const reading = await evaluate(socket, `(() => new Promise((resolve) => {
      const deadline = Date.now() + 2000;
      const tick = () => {
        const phase = window.__mwcp.session.save.phase;
        if (phase === 'reading') resolve('reading');
        else if (Date.now() > deadline) resolve(String(phase));
        else setTimeout(tick, 20);
      };
      tick();
    }))()`);
    assert.equal(reading, 'reading');
    await click(socket, '断开');
    const interrupted = await waitForText(socket, { timeoutMs: 3000, commandTimeoutMs: 1000, match: '读取没有完成' });
    assert.doesNotMatch(interrupted, /保存已确认/);
    assert.equal(await evaluate(socket, `window.__mwcp.session.save.message`), 'read_disconnected');
    const kind = await evaluate(socket, `window.__mwcp.simulation === true && window.__mwcp.session.mode`);
    assert.equal(kind, 'simulation');
  } finally {
    socket?.close();
    if (browser) await browser.close();
    await server.close();
    assert.equal(launchBrowser.active(), 0);
  }
});

async function click(cdp, label) {
  if (label === '快速验证') {
    throw new Error('Quick verification was removed; exercise the live view instead');
  }
  if (label === '在设备上验证') await evaluate(cdp, `(() => { const el = [...document.querySelectorAll('summary')].find((el) => el.textContent === '更多操作'); if (el && !el.parentElement.open) el.click(); })()`);
  const result = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
    if (!button) return 'missing';
    if (button.disabled) return 'disabled';
    button.click();
    return 'clicked';
  })()`);
  assert.equal(result, 'clicked', label);
}

async function dragHandle(cdp, id, dx, dy) {
  const point = await evaluate(cdp, `(async () => {
    const el=document.querySelector('[data-testid="${id}"]');el.scrollIntoView({block:'center',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+dx,y:point.y+dy,button:'left',buttons:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+dx,y:point.y+dy,button:'left',clickCount:1});
  await evaluate(cdp, 'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, 4000);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function screenshot(cdp, name) {
  if (!process.env.MWCP_SCREENSHOT_DIR) return;
  await mkdir(process.env.MWCP_SCREENSHOT_DIR, {recursive:true});
  await evaluate(cdp, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const result = await cdp.send('Page.captureScreenshot', {format:'png', captureBeyondViewport:true});
  await writeFile(join(process.env.MWCP_SCREENSHOT_DIR,name+'.png'), Buffer.from(result.data,'base64'));
}

function runBounded(command, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      killProcessTree(child).finally(() => reject(new Error(`command timeout ${timeoutMs}\n${stderr}\n${stdout}`)));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed ${code}\n${stderr}\n${stdout}`));
    });
  });
}

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const path = join(dir, decodeURIComponent(url.pathname === '/' ? '/console-browser.html' : url.pathname));
    try {
      const body = await readFile(path);
      response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('missing');
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      port: server.address().port,
      close() {
        for (const socket of sockets) socket.destroy();
        return new Promise((done) => {
          const timer = setTimeout(done, 500);
          server.close(() => {
            clearTimeout(timer);
            done();
          });
        });
      },
    }));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitPage(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = 'none';
  while (Date.now() < deadline) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) }).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      });
      const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
      last = 'no page';
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`browser debug timeout ${last}`);
}
