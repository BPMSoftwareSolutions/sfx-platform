import assert from 'node:assert/strict';
import fs from 'node:fs';
import {config, rest, read, write, json} from './common.mjs';
const state = read('state.json');
assert.equal((await rest('get','/config/web')).properties.linuxFxVersion, 'DOCKER|'+state.candidateImage);
assert.equal((await json(config.origin+'/healthz')).release,state.candidateRelease);
const receipt = {acceptedAt:new Date().toISOString(),release:state.candidateRelease,image:state.candidateImage,sourceCommit:state.sourceCommit,
  rollbackImage:state.previousImage,workflow:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`};
write('accepted.json',receipt);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Accepted **${receipt.release}**\n\nImage: \`${receipt.image}\`\n\nRollback: \`${receipt.rollbackImage}\`\n\nReal browser/live flow, replay, restart/vault, external API CLI and Windows login gates passed.\n`);
console.log(JSON.stringify(receipt));
