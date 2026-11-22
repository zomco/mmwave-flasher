import test from 'node:test';
import assert from 'node:assert/strict';
import { metricPresentation, signalLevel } from '../src/console/live-metrics.js';
import { consoleCopy } from '../src/console/copy.js';

test('friendly radar metrics retain zero, freshness and native/enhanced separation', () => {
  const show = (key, value, state = 'valid', language = 'zh', model = 'R60ABD1') => metricPresentation({key, value, state}, language, consoleCopy[language].states, model);
  assert.equal(show('breath_rate', 0).value, '0 次/分');
  assert.equal(show('breath_rate', 12).label, '呼吸频率');
  assert.equal(show('heart_rate', 70, 'valid', 'en').value, '70 bpm');
  assert.equal(show('breath_rate', 15, 'stale').value, consoleCopy.zh.states.stale);
  assert.equal(show('heart_rate', 80, 'unsupported').value, consoleCopy.zh.states.unsupported);
  assert.equal(show('distance.cm', null).value, consoleCopy.zh.states.unknown);
  assert.equal(show('diagnostics.local_z', 0).group, 'native');
  assert.equal(show('areas.occupancy', [true, false]).group, 'enhanced');
  assert.equal(show('areas.occupancy', [true, false]).value, '区域 1 · 有人 / 区域 2 · 无人');
  assert.equal(show('motion.state', 1).value, '静止');
  assert.equal(show('motion.state', 1, 'valid', 'zh', 'OTHER').value, '1');
  assert.equal(show('custom.value', 0).group, 'extension');
});

test('Wi-Fi signal buckets include weak and unknown values', () => {
  assert.deepEqual([-40,-55,-56,-70,-71,-90,null,undefined,NaN].map(signalLevel), [3,3,2,2,1,1,0,0,0]);
});
