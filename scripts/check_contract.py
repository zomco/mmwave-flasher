"""Check the pinned integration checkout and independently buildable JSON snapshots."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check():
    pin = json.loads((ROOT / 'component-pin.json').read_text(encoding='utf-8'))
    component = ROOT / '.component'
    if not (component / '.git').exists():
        raise ValueError('Run python scripts/prepare_component.py before integration tests or assembly')
    head = subprocess.check_output(['git', '-C', str(component), 'rev-parse', 'HEAD'], text=True).strip()
    if head != pin['revision']:
        raise ValueError(f'Component checkout is {head}; expected {pin["revision"]}')
    dirty = subprocess.check_output(['git', '-C', str(component), '-c', 'core.excludesFile=', 'status', '--porcelain', '--untracked-files=normal'], text=True)
    if dirty.strip():
        raise ValueError('The integration component checkout must be clean')
    for rel in pin['runtimeContracts']:
        if (ROOT / rel).read_bytes() != (component / rel).read_bytes():
            raise ValueError(f'Runtime contract snapshot differs from the pinned source: {rel}')
    # Older pins predate extraction; new component versions use release-targets.json.
    target_file = component / 'release-targets.json'
    if not target_file.exists():
        target_file = component / 'static/device-catalog.json'
    targets = json.loads(target_file.read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'static/device-catalog.json').read_text(encoding='utf-8'))
    accepted = {r['id']: r for r in targets['radars'] if r['status'] == 'Completed'}
    boards = {b['id']: b for b in targets['boards']}
    for radar in catalog['radars']:
        if radar['status'] != 'Completed':
            continue
        if radar['id'] not in accepted:
            raise ValueError(f'Unaccepted storefront model: {radar["id"]}')
        for key in ('dimension', 'chipFamily', 'config'):
            if radar[key] != accepted[radar['id']][key]:
                raise ValueError(f'Catalog mismatch: {radar["id"]}.{key}')
    for board in catalog['boards']:
        expected = boards.get(board['id'])
        if not expected or any(board[key] != expected[key] for key in ('chipFamily', 'uart')):
            raise ValueError(f'Unaccepted board or UART mapping: {board["id"]}')
    return pin


if __name__ == '__main__':
    print('Contract verified:', check()['revision'])
