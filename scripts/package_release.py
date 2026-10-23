#!/usr/bin/env python3
"""Package the committed source, portable skills, and prebuilt local runtime."""

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

    artifacts = [source]
    for skill_root in sorted((ROOT / 'skills').iterdir()):
        if not (skill_root / 'SKILL.md').is_file():
            continue
        skill = target / f'{skill_root.name}-{version}.skill.zip'
        add_files(skill, [(path, f'{skill_root.name}/{path.relative_to(skill_root).as_posix()}')
                         for path in skill_root.rglob('*') if path.is_file()])
        artifacts.append(skill)

    prefix = 'karmen-memory/'
    runtime_entries = [(ROOT / name, prefix + name) for name in tracked if name]
    runtime_entries.extend((path, prefix + 'dist/' + path.relative_to(ROOT / 'dist').as_posix())
                           for path in (ROOT / 'dist').rglob('*') if path.is_file())
    runtime = target / f'karmen-memory-{version}-runtime.zip'
    add_files(runtime, runtime_entries)
    artifacts.append(runtime)

    sums = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n'
                   for path in artifacts)
    (target / 'SHA256SUMS').write_text(sums)
    (target / 'build-info.json').write_text(json.dumps({
        'version': version,
        'commit': commit,
        'status': 'local-alpha',
        'artifacts': [path.name for path in artifacts],
        'cliAndMcp': True,
        'sqliteService': True,
        'authenticatedHttpsSharing': True,
        'nativeHostAcceptance': False,
        'lanSynchronization': False,
    }, indent=2) + '\n')
    print(json.dumps({'version': version, 'commit': commit,
                      'artifacts': [path.name for path in artifacts],
                      'integrity': 'passed'}, indent=2))


if __name__ == '__main__':
    main()
