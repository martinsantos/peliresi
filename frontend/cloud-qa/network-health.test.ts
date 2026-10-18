import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedOfflineConsole, qaManifestIcon, diagnosticResourceUrl, type IconProof } from './network-health.ts';
const warning=`Error while trying to use the following icon from the Manifest: ${qaManifestIcon} (Download error or resource isn't a valid image)`;
const event={text:warning,at:'2026-10-06T17:00:00Z',deliberatelyOffline:true};
const before:IconProof={url:qaManifestIcon,at:'2026-10-06T16:59:00Z',status:200,mime:'image/png',width:512,height:512,sha256:'a'.repeat(64)};
const after={...before,at:'2026-10-06T17:01:00Z'};
test('a known offline icon warning needs real matching decoded bytes on both sides',()=>{
  assert.equal(expectedOfflineConsole(event,[before,after]),true);
  for(const proofs of [[],[before],[after]])assert.equal(expectedOfflineConsole(event,proofs),false);
});
test('an online warning is never excused, even if the icon is valid',()=>{
  assert.equal(expectedOfflineConsole({...event,deliberatelyOffline:false},[before,after]),false);
});
test('wrong hash, HTTP status, MIME, dimensions, timing or resource remains a failure',()=>{
  for(const change of [{sha256:'b'.repeat(64)},{status:404},{mime:'text/html'},{width:192},{height:192},{at:before.at},{url:'http://example.invalid/icon.png'}])
    assert.equal(expectedOfflineConsole(event,[before,{...after,...change}]),false);
});
test('unknown icons, messages and JavaScript errors are not swallowed',()=>{
  for(const text of [warning.replace('512','192'),warning.replace('4177','3002'),'TypeError: broken handler','Failed to load resource: the server responded with a status of 500'])
    assert.equal(expectedOfflineConsole({...event,text},[before,after]),false);
});
test('plain disconnected transport is expected only during the controlled offline context',()=>{
  const transport={...event,text:'Failed to load resource: net::ERR_INTERNET_DISCONNECTED'};
  assert.equal(expectedOfflineConsole(transport,[]),true);
  assert.equal(expectedOfflineConsole({...transport,deliberatelyOffline:false},[]),false);
});
test('resource diagnostics identify the host and path without query, fragment or credentials',()=>{
  assert.equal(diagnosticResourceUrl('https://user:password@fonts.googleapis.com/css2?family=Inter#private'),'https://fonts.googleapis.com/css2');
  assert.equal(diagnosticResourceUrl('http://127.0.0.1:4177/api/auth/profile?token=secret'),'http://127.0.0.1:4177/api/auth/profile');
});
test('inline, missing and non-network console locations never disclose their contents',()=>{
  for(const url of ['', 'data:text/plain,secret', 'blob:http://127.0.0.1/private', '/relative?secret', 'chrome://settings/private'])
    assert.equal(diagnosticResourceUrl(url),'[non-network resource]');
});
