"""Fail closed when a UI contract or hardware catalog drifts from its source."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('contract_check', ROOT / 'scripts/check_contract.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pin = {'revision': 'a' * 40, 'runtimeContracts': ['docs/protocol/schema.json']}
        self.radar = {'id': 'r60abd1', 'dimension': '2D', 'status': 'Completed', 'chipFamily': 'ESP32-C3', 'config': 'tests/r60.yaml'}
        self.board = {'id': 'c3', 'chipFamily': 'ESP32-C3', 'uart': {'tx': 21, 'rx': 20}}
        self.catalog = {'radars': [self.radar], 'boards': [self.board]}
        self.write('component-pin.json', self.pin)
        self.write('static/device-catalog.json', self.catalog)
        self.write('.component/release-targets.json', self.catalog)
        self.write('docs/protocol/schema.json', {'type': 'object'})
        self.write('.component/docs/protocol/schema.json', {'type': 'object'})
        (self.root / '.component/.git').mkdir()
        self.addCleanup(patch.stopall)
        patch.object(c, 'ROOT', self.root).start()
        self.git = patch.object(c.subprocess, 'check_output', side_effect=['a' * 40, '']).start()

    def write(self, rel, value):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding='utf-8')

    def test_matching_split_component_inventory(self):
        self.assertEqual(c.check(), self.pin)

    def test_wrong_revision_is_rejected(self):
        self.git.side_effect = ['b' * 40]
        with self.assertRaisesRegex(ValueError, 'expected'):
            c.check()

    def test_dirty_dependency_is_rejected(self):
        self.git.side_effect = ['a' * 40, ' M components/mmwave_host/mwcp_service.cpp']
        with self.assertRaisesRegex(ValueError, 'clean'):
            c.check()

    def test_runtime_snapshot_drift_is_rejected(self):
        self.write('docs/protocol/schema.json', {'type': 'string'})
        with self.assertRaisesRegex(ValueError, 'snapshot differs'):
            c.check()

    def test_unaccepted_radar_is_rejected(self):
        self.radar['id'] = 'new-radar'
        self.write('static/device-catalog.json', self.catalog)
        with self.assertRaisesRegex(ValueError, 'Unaccepted storefront'):
            c.check()

    def test_uart_mismatch_is_rejected(self):
        self.board['uart']['tx'] = 4
        self.write('static/device-catalog.json', self.catalog)
        with self.assertRaisesRegex(ValueError, 'UART'):
            c.check()
