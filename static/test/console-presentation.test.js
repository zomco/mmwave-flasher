import test from 'node:test';
import assert from 'node:assert/strict';
import { savedConfig, stackStatus, presentation } from '../src/console/presentation.js';
import { consoleCopy } from '../src/console/copy.js';
import { targetRows } from '../src/console/observe.js';

test('stack shows connection, protocol and application separately without interpreting missing data as no vitals', () => {
  const base = {sessionLive:false,configRevision:null,layers:{port:'closed',protocol:'offline',data:'none'}};
  for (const language of ['zh','en']) {
    const u = presentation[language], t = consoleCopy[language];
    const disconnected = stackStatus(base,t,u);
    assert.equal(disconnected.length,3);
    assert.equal(disconnected[2].value,u.waiting);
    assert.ok(disconnected.every((s) => !s.good));
    const awaiting = stackStatus({...base,sessionLive:true,configRevision:1,layers:{port:'open',protocol:'online',data:'none'}},t,u);
    assert.equal(awaiting[2].value,u.statusValues.none);
    assert.equal(awaiting[2].good,false);
    assert.equal(awaiting[1].good,true);
  }
});

test('live scene uses read-back configuration rather than unsaved drafts', () => {
  assert.deepEqual(savedConfig({configItems:[{key:'install.yaw_deg',value:0}],draft:{'install.yaw_deg':90}}), {'install.yaw_deg':0});
});

test('boundary classification accepts protocol coordinate pairs and distinguishes inside/outside', () => {
  const polygon = [[-100,-100],[100,-100],[100,100],[-100,100]];
  const rows = targetRows({targets:[{room_cm:[0,0],position_quality:'valid'},{room_cm:[200,0],position_quality:'valid'}]},polygon);
  assert.equal(rows[0].faded,false);
  assert.equal(rows[1].faded,true);
});
