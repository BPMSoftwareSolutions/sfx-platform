"""Retain the private Space adapter's responses using an authorized HF token."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import httpx

root = Path(__file__).resolve().parent.parent
publication = json.loads((root / 'generated/lab-publication.json').read_text())
origin = 'https://bpmsoftwaresolutions-sidefx.hf.space'
directory = root / 'artifacts/deployment/huggingface-verification'
directory.mkdir(parents=True, exist_ok=True)
summary = {'origin': origin, 'publicationId': publication['publicationId'], 'observedAt': datetime.now(timezone.utc).isoformat(), 'checks': []}
with httpx.Client(timeout=150, headers={'Authorization': 'Bearer ' + os.environ['HF_TOKEN'], 'Origin': origin}) as client:
    for pilot in publication['pilots']:
        profile = pilot['profile']
        values = {b['pointer']: b.get('enum', ['AAPL' if b.get('pattern') else 'Zoë <script>'])[0] for b in profile['inputs'] if b['ownership'] == 'editable'}
        request = {'publicationId': publication['publicationId'], 'subject': profile['subject'], 'values': values}
        if pilot['examples']:
            request['exampleId'] = pilot['examples'][1]['id']
        response = client.post(origin + '/lab/commands', json=request)
        response.raise_for_status()
        result = response.json()
        (directory / (profile['subject'] + '.json')).write_text(json.dumps({'request': request, 'result': result}, indent=2) + '\n')
        assert result['status'] == 'EXECUTED', result
        assert result['disposition'] == 'terminated', result
        assert result['evidence']['authorityIdentity'] == pilot['authority']['identity']
        check = {'subject': profile['subject'], 'passed': True, 'outcome': result['outcome']}
        if profile.get('providerInputBindingDigest'):
            check['exchange'] = result['evidence']['providerInput']['exchange']
            assert check['exchange']['httpStatus'] == 200
            assert result['outcome']['payload']['observedPrice'] == result['execution']['result']['input']['payload']['nativeTestimony']['quoteSummary']['result'][0]['price']['regularMarketPrice']['raw']
        summary['checks'].append(check)
        print(json.dumps({'subject': profile['subject'], 'passed': True}))
    forged = {**request, 'values': {**request['values'], '/payload/nativeTestimony': {}}}
    refused = client.post(origin + '/lab/commands', json=forged).json()
    assert refused['status'] == 'REFUSED' and refused['code'] == 'INPUT_OWNERSHIP_REFUSED'
    summary['checks'].append({'id': 'Space-rejects-provider-testimony-forgery', 'passed': True})
(directory / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'directory': str(directory), 'checks': len(summary['checks'])}))
