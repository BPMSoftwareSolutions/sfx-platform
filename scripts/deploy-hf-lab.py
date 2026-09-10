"""Deploy only the reviewed renderer artifact; credentials use Space secrets."""
import json
from pathlib import Path
from huggingface_hub import HfApi

root = Path(__file__).resolve().parent.parent
api = HfApi()
repo = 'BPMSoftwareSolutions/SideFX'
info = api.space_info(repo)
if not info.private:
    raise RuntimeError('PRIVATE_SPACE_REQUIRED')
settings = dict(line.split('=', 1) for line in (root / 'artifacts/deployment/runtime.env').read_text(encoding='utf-8-sig').splitlines() if '=' in line)
endpoint = 'https://bpm-sidefx-lab-api.azurewebsites.net'
origin = 'https://bpmsoftwaresolutions-sidefx.hf.space'
for key, value in {'SIDEFX_INVOCATION_ENDPOINT': endpoint, 'SIDEFX_SERVICE_TOKEN': settings['SIDEFX_SERVICE_TOKEN'], 'SIDEFX_LAB_ORIGIN': origin}.items():
    api.add_space_secret(repo, key=key, value=value)
commit = api.upload_folder(repo_id=repo, repo_type='space', folder_path=root / 'artifacts/deployment/huggingface',
    ignore_patterns=['.next/**', 'node_modules/**', '.git/**', '*.log', '.env*'],
    commit_message='Deploy circuit workbench with generated dialogs and observed execution')
result = {'space': repo, 'private': True, 'commit': commit.oid, 'endpoint': endpoint, 'origin': origin}
(root / 'artifacts/deployment/huggingface-deployment.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
