import test from 'node:test';
import assert from 'node:assert/strict';
import { savedConfig, stackStatus, presentation } from '../src/console/presentation.js';
import { consoleCopy } from '../src/console/copy.js';
import { targetRows } from '../src/console/observe.js';

test('four stack layers cascade and unknown presence never means healthy radar', () => {
  const base = {sessionLive:false,configRevision:null,layers:{port:'closed',protocol:'offline',data:'none'}};
  for (const language of ['zh','en']) {
    const u = presentation[language], t = consoleCopy[language];
    const disconnected = stackStatus(base,t,u);
    assert.equal(disconnected.length,4);
    assert.equal(disconnected[2].value,u.waiting);
    assert.ok(disconnected.every((s) => !s.good));
    const awaiting = stackStatus({...base,sessionLive:true,configRevision:1,layers:{port:'open',protocol:'online',data:'none'}},t,u);
    assert.equal(awaiting[2].value,u.waiting);
    assert.equal(awaiting[2].good,false);
    assert.equal(awaiting[1].good,true);
    const valid={...base,identity:{firmware_version:'test'},status:{uptime_ms:0},sessionLive:true,layers:{port:'open',protocol:'online',radar:'healthy'}};
    assert.deepEqual(stackStatus(valid,t,u,{presence:'absent'}).map(l=>l.good),[true,true,true,true]);
    assert.deepEqual(stackStatus(valid,t,u,{presence:'stale'}).map(l=>l.good),[true,true,true,false]);
    assert.deepEqual(stackStatus({...valid,status:null},t,u,{presence:'present'}).map(l=>l.good),[true,true,false,false]);
    assert.deepEqual(stackStatus({...valid,sessionLive:false},t,u,{presence:'present'}).map(l=>l.good),[true,false,false,false]);
    assert.deepEqual(stackStatus({...valid,layers:{...valid.layers,port:'closed'}},t,u,{presence:'present'}).map(l=>l.good),[false,false,false,false]);
  }
});

test('live scene uses read-back configuration rather than unsaved drafts', () => {
  assert.deepEqual(savedConfig({configItems:[{key:'install.yaw_deg',value:0}],draft:{'install.yaw_deg':90}}), {'install.yaw_deg':0});
});

test('healthy stack shows reported models and protocol without guessing the MCU', () => {
  const u=presentation.zh, t=consoleCopy.zh;
  const snap={identity:{configured_model:'r60abd1',chip_model:'esp32c3',firmware_version:'dev',protocol:{major:1,minor:0}},status:{uptime_ms:0},sessionLive:true,layers:{port:'open',protocol:'online',radar:'healthy'}};
  const layers=stackStatus(snap,t,u,{presence:'absent'});
  assert.equal(layers[1].detail,'MWCP 1.0');
  assert.equal(layers[2].detail,'ESP32C3 · dev');
  assert.equal(layers[3].detail,'R60ABD1');
  delete snap.identity.chip_model;
  assert.equal(stackStatus(snap,t,u,{presence:'absent'})[2].detail,'未上报 · dev');
});

test('boundary classification accepts protocol coordinate pairs and distinguishes inside/outside', () => {
  const polygon = [[-100,-100],[100,-100],[100,100],[-100,100]];
  const rows = targetRows({targets:[{room_cm:[0,0],position_quality:'valid'},{room_cm:[200,0],position_quality:'valid'}]},polygon);
  assert.equal(rows[0].faded,false);
  assert.equal(rows[1].faded,true);
});
