// Operator acceptance only: generated disposable fixture arrives on a private pipe.
// Production enrollment still requires the installed CLI's hidden terminal prompt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
let input='';for await(const chunk of process.stdin)input+=chunk;
const fixture=JSON.parse(input);input='';
const pty=createRequire(import.meta.url)(process.env.SFX_LOGIN_TEST_PTY_MODULE);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sfx-enroll-acceptance-'));
const checks=[];
async function enroll(mode){
 return new Promise((resolve,reject)=>{
  const environment={...process.env,SFX_SESSION_HOME:root};delete environment.SFX_API_ENDPOINT;
  const terminal=pty.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(fixture.bin,'sfx-api.ps1'),
   'enroll','--endpoint',fixture.endpoint,'--username',fixture.identifier,'--json'],{env:environment,cwd:os.tmpdir(),cols:180,rows:24,useConptyDll:true});
  let output='',stage=0;
  const timer=setTimeout(()=>{terminal.kill();reject(new Error('Enrollment prompt timeout'));},90000);
  terminal.onData(value=>{
   output+=value;
   if(stage===0&&output.includes('Password: ')){stage=1;terminal.write(mode==='cancel'?'\x03':(mode==='short'?'short':fixture.password)+'\r');}
   if(stage===1&&output.includes('Confirm password: ')){stage=2;terminal.write((mode==='mismatch'?fixture.password+'wrong':mode==='short'?'short':fixture.password)+'\r');}
  });
  terminal.onExit(({exitCode})=>{clearTimeout(timer);if(output.includes(fixture.password))reject(new Error('Password echoed'));else resolve({exitCode,output,stage});});
 });
}
const passed=name=>{checks.push(name);process.stderr.write('PASS '+name+'\n');};
try{
 let result=await enroll('cancel');assert.notEqual(result.exitCode,0);assert.equal(result.stage,1);passed('Enrollment Ctrl+C exits without submission');
 result=await enroll('mismatch');assert.notEqual(result.exitCode,0);assert.equal(result.stage,2);assert.ok(result.output.includes('ENROLLMENT_PASSWORD_MISMATCH'));passed('Enrollment confirms password privately and refuses mismatch');
 result=await enroll('short');assert.notEqual(result.exitCode,0);assert.ok(result.output.includes('ENROLLMENT_REJECTED'));passed('Real circuit rejects short password');
 result=await enroll('valid');assert.equal(result.exitCode,0);assert.ok(result.output.includes('"disposition":"ENROLLED"'));passed('Installed CLI enrolls through staging API and real circuit');
 result=await enroll('duplicate');assert.notEqual(result.exitCode,0);assert.ok(result.output.includes('ALREADY_ENROLLED'));passed('Duplicate returns declared outcome and nonzero CLI exit');
 const child=spawn(process.execPath,[new URL('./live-auth-test.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>{err+=x;if(!String(x).includes(fixture.password))process.stderr.write(x)});
 child.stdin.end(JSON.stringify(fixture));const code=await new Promise(resolve=>child.on('close',resolve));
 assert.equal(code,0);assert.ok(!out.includes(fixture.password)&&!err.includes(fixture.password));passed('New enrollment completes installed CLI login, whoami and logout');
 process.stdout.write(JSON.stringify({checks,count:checks.length,login:JSON.parse(out),inputMode:'Installed Windows ConPTY command',endpoint:fixture.endpoint})+'\n');
}catch(error){process.stderr.write('ENROLLMENT_CLI_ACCEPTANCE_FAILED after '+checks.length+' checks ('+error.name+'; private diagnostic suppressed)\n');process.exitCode=1;}
finally{
 // This directory was created above with a fixed prefix under the OS temp root.
 const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('sfx-enroll-acceptance-'))throw new Error('Invalid cleanup target');
 fs.rmSync(resolved,{recursive:true,force:true});
}
process.exit(process.exitCode||0);
