import {readFileSync,realpathSync,lstatSync,unlinkSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {VisualPublication} from '../contracts/visuals.ts';

// Only obsolete, unchanged delivery artifacts from the committed publication are
// eligible. Originals remain in SQL; unrelated files and modified bytes are kept.
const prior=VisualPublication.parse(JSON.parse(execFileSync('git',['show','HEAD:generated/visual-publication.json'],{encoding:'utf8',maxBuffer:20*1024*1024})));
const current=VisualPublication.parse(JSON.parse(readFileSync('generated/visual-publication.json','utf8')));
const root=realpathSync(resolve('public/media')),obsolete:string[]=[];
for(const [url,proof] of Object.entries(prior.artifacts)){
 if(current.artifacts[url])continue;
 const target=resolve('public','.'+url);
 if(!target.startsWith(root+sep))throw new Error('MEDIA_PRUNE_PATH_ESCAPE');
 let stat;try{stat=lstatSync(target);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
 if(!stat.isFile()||stat.isSymbolicLink()||!realpathSync(target).startsWith(root+sep))throw new Error('MEDIA_PRUNE_NOT_REGULAR_FILE');
 const bytes=readFileSync(target);
 if(bytes.length!==proof.bytes||createHash('sha256').update(bytes).digest('hex')!==proof.sha256)throw new Error('MEDIA_PRUNE_MODIFIED_ARTIFACT:'+url);
 obsolete.push(target);
}
if(process.argv.includes('--apply'))for(const target of obsolete)unlinkSync(target);
console.log(JSON.stringify({state:process.argv.includes('--apply')?'OBSOLETE_DELIVERY_REMOVED':'PRUNE_PREVIEW',files:obsolete.length}));
