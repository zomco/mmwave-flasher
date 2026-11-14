"""Fetch only the explicitly pinned integration dependency; never reset a checkout."""
import json
from pathlib import Path
import re
import subprocess
from check_contract import check

ROOT = Path(__file__).resolve().parents[1]
pin = json.loads((ROOT / 'component-pin.json').read_text(encoding='utf-8'))
if pin['repository'] != 'zomco/mmwave-component' or not re.fullmatch(r'[0-9a-f]{40}', pin['revision']):
    raise SystemExit('Invalid component pin')
dest = ROOT / '.component'
if not dest.exists():
    subprocess.run(['git', 'init', str(dest)], check=True)
    subprocess.run(['git', '-C', str(dest), 'remote', 'add', 'origin', 'https://github.com/' + pin['repository'] + '.git'], check=True)
    subprocess.run(['git', '-C', str(dest), 'fetch', '--depth=1', 'origin', pin['revision']], check=True)
    subprocess.run(['git', '-C', str(dest), 'checkout', '--detach', pin['revision']], check=True)
print('Contract verified:', check()['revision'])
