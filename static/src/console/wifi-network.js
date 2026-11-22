// Scan auth and provisioning auth have different meanings. The ESPHome scan
// adapter reports authenticated APs as "unknown" because it only has a boolean
// authentication flag. Allow a password connection attempt without claiming to
// have identified the AP's encryption mode. Keep the raw scan result unchanged.
export function wifiProvisionAuth(scanAuth) {
  if (scanAuth === 'open') return 'open';
  if (scanAuth === 'unknown' || scanAuth === 'wpa2_psk') return 'wpa2_psk';
  return null;
}
