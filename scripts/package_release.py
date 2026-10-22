#!/usr/bin/env python3
"""Package the committed source, portable skill, and built static preview."""

import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def add_files(archive, entries):
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for path, name in sorted(entries, key=lambda item: item[1]):
            output.write(path, name)
    with zipfile.ZipFile(archive) as output:
        invalid = output.testzip()
        if invalid:
            raise RuntimeError(f'Archive integrity check failed: {invalid}')


def main():
    if git('status', '--porcelain'):
        raise SystemExit('Commit or separately preserve working changes before packaging.')
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Run npm ci and npm run build before packaging.')

    version = json.loads((ROOT / 'package.json').read_text())['version']
    commit = git('rev-parse', 'HEAD')
    target = ROOT / 'release'
    target.mkdir(exist_ok=True)
    tracked = git('ls-files', '-z').split('\0')
    source = target / f'karmen-memory-{version}-source.zip'
    add_files(source, [(ROOT / name, f'karmen-memory/{name}') for name in tracked if name])

    skill_root = ROOT / 'skills/shared-memory-console'
    skill = target / f'shared-memory-console-{version}.skill.zip'
    add_files(skill, [(path, f'shared-memory-console/{path.relative_to(skill_root).as_posix()}')
                      for path in skill_root.rglob('*') if path.is_file()])

    prefix = 'karmen-memory-preview/'
    preview_entries = [(path, prefix + path.relative_to(ROOT / 'dist').as_posix())
                       for path in (ROOT / 'dist').rglob('*') if path.is_file()]
    preview_entries.extend((ROOT / name, prefix + name)
                           for name in ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md'])
    preview_entries.extend((path, prefix + path.relative_to(ROOT).as_posix())
                           for path in (ROOT / 'LICENSES').glob('*') if path.is_file())
    preview_entries.append((ROOT / 'docs/preview.md', prefix + 'PREVIEW.md'))
    preview = target / f'karmen-memory-{version}-preview.zip'
    add_files(preview, preview_entries)

    artifacts = [source, skill, preview]
    sums = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n'
                   for path in artifacts)
    (target / 'SHA256SUMS').write_text(sums)
    (target / 'build-info.json').write_text(json.dumps({
        'version': version,
        'commit': commit,
        'status': 'prerelease-prototype',
        'artifacts': [path.name for path in artifacts],
        'liveAdapters': False,
        'lanSynchronization': False,
    }, indent=2) + '\n')
    print(json.dumps({'version': version, 'commit': commit,
                      'artifacts': [path.name for path in artifacts],
                      'integrity': 'passed'}, indent=2))


if __name__ == '__main__':
    main()
