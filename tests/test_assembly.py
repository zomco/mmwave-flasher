"""Offline release assembly regression tests; never access devices."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('assemble', ROOT / 'scripts/assemble.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

class AssemblyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.build = self.root / 'build/r60abd1-ESP32-C3'
        self.build.mkdir(parents=True)
        self.version = 'v1.0.0-alpha.1'
        self.manifest = {'name': 'R60ABD1', 'version': self.version, 'builds': [{'chipFamily': 'ESP32-C3', 'parts': [{'path': 'factory.bin', 'offset': 0}], 'ota': {'path': 'ota.bin', 'md5': r.firmware.hashlib.md5(b'ota').hexdigest()}}]}
        r.write(self.build / 'manifest.json', self.manifest)
        (self.build / 'factory.bin').write_bytes(b'factory')
        (self.build / 'ota.bin').write_bytes(b'ota')

    def package(self):
        dest = self.root / 'alpha'
        r.firmware.package(self.root / 'build', dest, self.version, 'a' * 40, '2026.9.0')
        return dest

    def test_assemble_empty_history_drops_legacy_index_without_contacting_pages(self):
        output = self.root / 'site'
        output.mkdir()
        r.write(output / 'models.json', [{'id': 'old', 'manifest': 'old/manifest.json'}])
        with patch.object(r, 'gh', return_value='[]') as gh, patch('urllib.request.urlopen', side_effect=AssertionError('Pages must not be requested')):
            r.assemble('owner/repo', output)
        gh.assert_called_once_with('api', 'repos/owner/repo/releases?per_page=100&page=1')
        self.assertEqual(r.read(output / 'releases.json')['releases'], [])
        self.assertEqual(r.read(output / 'models.json'), [])

    def test_assemble_release_api_errors_still_fail(self):
        with patch.object(r, 'gh', side_effect=RuntimeError('GitHub API unavailable')):
            with self.assertRaisesRegex(RuntimeError, 'GitHub API unavailable'):
                r.assemble('owner/repo', self.root / 'site')

    def test_pages_workflow_has_no_previous_site_argument(self):
        workflow = (ROOT / '.github/workflows/publish-pages.yml').read_text(encoding='utf-8')
        self.assertIn('scripts/assemble.py zomco/mmwave-component static/dist', workflow)
        self.assertNotIn('github.io', workflow)
        self.assertNotIn('preserve existing OTA', workflow)

    def test_assemble_local_releases_alpha_only_and_beta_promotion(self):
        alpha = self.package()
        site_alpha = self.root / 'site_alpha'
        r.assemble('none', site_alpha, local_releases=alpha)
        # Alpha-only: releases has 1 release, models.json is empty, no stable OTA alias
        releases_data = r.read(site_alpha / 'releases.json')
        self.assertEqual(len(releases_data['releases']), 1)
        self.assertEqual(releases_data['releases'][0]['channel'], 'alpha')
        self.assertEqual(r.read(site_alpha / 'models.json'), [])
        self.assertFalse((site_alpha / 'r60abd1-ESP32-C3').exists())
        self.assertTrue((site_alpha / 'firmware' / self.version / 'r60abd1-ESP32-C3' / 'manifest.json').exists())

        # Promote to Beta
        beta = self.root / 'beta'
        r.firmware.promote(alpha, beta, 'v1.0.0-beta.1', 'hardware passed')
        local_dir = self.root / 'local_releases'
        local_dir.mkdir()
        r.shutil.copytree(alpha, local_dir / 'alpha')
        r.shutil.copytree(beta, local_dir / 'beta')

        site_all = self.root / 'site_all'
        r.assemble('none', site_all, local_releases=local_dir)
        releases_all = r.read(site_all / 'releases.json')
        self.assertEqual(len(releases_all['releases']), 2)
        # Beta is first because it sorts by channel/version
        self.assertEqual(releases_all['releases'][0]['channel'], 'beta')
        self.assertEqual(releases_all['releases'][1]['channel'], 'alpha')
        # Beta generates stable OTA alias and models.json
        models = r.read(site_all / 'models.json')
        self.assertEqual(models, [{'id': 'r60abd1-ESP32-C3', 'manifest': 'r60abd1-ESP32-C3/manifest.json'}])
        self.assertTrue((site_all / 'r60abd1-ESP32-C3' / 'factory.bin').exists())
        self.assertEqual((site_all / 'r60abd1-ESP32-C3' / 'factory.bin').read_bytes(), b'factory')

    def test_history_keeps_versions_and_only_latest_beta_updates_ota(self):
        alpha = self.package()
        beta1, beta2 = self.root / 'beta1', self.root / 'beta2'
        r.firmware.promote(alpha, beta1, 'v1.0.0-beta.1', 'hardware passed')
        self.manifest['version'] = 'v1.0.0-alpha.2'
        r.write(self.build / 'manifest.json', self.manifest)
        (self.build / 'factory.bin').write_bytes(b'tested-second-factory')
        second = self.root / 'second'
        r.firmware.package(self.root / 'build', second, 'v1.0.0-alpha.2', 'b' * 40, '2026.9.0')
        r.firmware.promote(second, beta2, 'v1.0.0-beta.2', 'second hardware passed')
        self.manifest['version'] = 'v1.0.0-alpha.3'
        r.write(self.build / 'manifest.json', self.manifest)
        (self.build / 'factory.bin').write_bytes(b'UNTESTED-third-factory')
        third = self.root / 'third'
        r.firmware.package(self.root / 'build', third, 'v1.0.0-alpha.3', 'c' * 40, '2026.9.0')
        bundles = {r.read(d / 'release.json')['version']: d for d in (beta1, beta2, third)}
        history = [{'tag_name': tag, 'draft': False, 'published_at': f'2026-10-{10 + i:02d}T10:00:00Z',
                    'assets': [{'name': n} for n in ('release.json', 'firmware-bundle.zip')]}
                   for i, tag in enumerate(bundles)]
        def download(repo, tag, dest):
            r.shutil.copytree(bundles[tag], dest)
            return r.validate_bundle(r.read(dest / 'release.json'), dest / 'firmware-bundle.zip')
        output = self.root / 'site'
        with patch.object(r, 'gh', return_value=json.dumps(history)), patch.object(r, 'download_release', side_effect=download):
            r.assemble('owner/repo', output)
        self.assertEqual(len(r.read(output / 'releases.json')['releases']), 3)
        self.assertEqual((output / 'r60abd1-ESP32-C3/factory.bin').read_bytes(), b'tested-second-factory')
        self.assertEqual(r.read(output / 'r60abd1-ESP32-C3/manifest.json')['version'], 'v1.0.0-alpha.2')
        self.assertTrue((output / 'firmware/v1.0.0-alpha.3/r60abd1-ESP32-C3/factory.bin').exists())
