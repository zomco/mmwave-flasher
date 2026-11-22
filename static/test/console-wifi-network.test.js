import test from 'node:test';
import assert from 'node:assert/strict';
import { wifiProvisionAuth } from '../src/console/wifi-network.js';
import { wifiPasswordIssue } from '../src/protocol/contract.js';

test('authenticated APs with unspecified scan auth allow a validated password attempt', () => {
  assert.equal(wifiProvisionAuth('unknown'), 'wpa2_psk');
  assert.equal(wifiProvisionAuth('wpa2_psk'), 'wpa2_psk');
  const auth = wifiProvisionAuth('unknown');
  assert.equal(wifiPasswordIssue({auth,password:'test-passphrase'}), null);
  assert.equal(wifiPasswordIssue({auth,password:''}).code, 'INVALID_ARGUMENT');
  assert.equal(wifiPasswordIssue({auth,password:'short'}).code, 'INVALID_ARGUMENT');
});

test('open networks stay open and unrecognized auth is not silently downgraded', () => {
  assert.equal(wifiProvisionAuth('open'), 'open');
  assert.equal(wifiPasswordIssue({auth:wifiProvisionAuth('open'),password:''}), null);
  for (const auth of [null,undefined,'','enterprise','wep','unsupported']) assert.equal(wifiProvisionAuth(auth), null);
});
