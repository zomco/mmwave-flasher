# Flasher maintenance

- This repository owns the website and Web Serial host UI. Firmware implementations and releases belong to mmwave-component.
- Read README.md and docs/architecture/0001-independent-flasher.md before changing repository boundaries. Follow docs/PUBLISHING.md for deployments.
- Accept core user paths and data/configuration safety. Defer exhaustive matrices, optional diagnostics, BLE and long hardware tests; do not recreate historic G2 gates.
- Do not operate hardware, Home Assistant, publish releases or deploy Pages without separate authorization.
- component-pin.json identifies the read-only integration dependency. Keep runtime contract snapshots byte-identical to that revision; test pin changes. Never edit .component/ as product source.
- Historical reports retain original paths and conclusions; do not bulk rewrite evidence.
