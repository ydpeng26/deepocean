// Synthetic pixels, mocked canvas/storage and actual source modules. No network.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto, randomUUID } from 'node:crypto';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, require, globals = {}, suffix = '') {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path) + suffix, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, File, Blob, Uint8ClampedArray, crypto: { subtle: webcrypto.subtle, randomUUID }, fetch() { throw Error('No network'); }, ...globals });
  return module.exports;
}
const background = load('src/lib/gear-background.ts', () => ({}));
const width = 32, height = 32, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
for (let y=8;y<24;y++) for(let x=8;x<24;x++) { const p=(y*width+x)*4; pixels[p]=15;pixels[p+1]=80;pixels[p+2]=150; }
const before = new Uint8ClampedArray(pixels);
let result = background.removeLightBackground(pixels,width,height);
assert.equal(result.status,'removed'); assert.equal(result.pixels[3],0);
assert.equal(result.pixels[(16*width+16)*4+3],255); assert.deepEqual(pixels,before);
let transparent = new Uint8ClampedArray(pixels); transparent[3]=0;
assert.equal(background.removeLightBackground(transparent,width,height).status,'already-transparent');
let complex = new Uint8ClampedArray(pixels); complex[0]=80;
assert.equal(background.removeLightBackground(complex,width,height).status,'not-simple');
assert.equal(background.removeLightBackground(new Uint8ClampedArray(pixels.length).fill(255),width,height).status,'not-simple');
assert.throws(()=>background.removeLightBackground(pixels,0,32));
console.log('PASS: pure light background edge flood removes outside, preserves subject/input/alpha, rejects ambiguous/all-background images');

let closed=0, canvasPixels;
const canvas={width:0,height:0,getContext(){return {
  drawImage(){canvasPixels=new Uint8ClampedArray(pixels);},
  getImageData(){return {data:new Uint8ClampedArray(canvasPixels)};},
  putImageData(data){canvasPixels=new Uint8ClampedArray(data.data);},
};},toBlob(callback,type){assert.equal(type,'image/png');callback(new Blob([canvasPixels],{type}));}};
const images=load('src/lib/images.ts', name => name === './gear-background' ? background : {}, {
  createImageBitmap: async () => ({width,height,close(){closed++;}}),
  document:{createElement(){return canvas;}},
});
const prepared=await images.prepareGearPhoto(new File(['synthetic'],'equipment.jpg',{type:'image/jpeg'}));
assert.equal(prepared.status,'removed');assert.equal(prepared.original.type,'image/png');assert.equal(prepared.cutout.type,'image/png');
assert.equal(new Uint8Array(await prepared.original.arrayBuffer())[3],255);
assert.equal(new Uint8Array(await prepared.cutout.arrayBuffer())[3],0);assert.equal(closed,1);
await assert.rejects(images.prepareGearPhoto(new File(['x'],'x.heic',{type:'image/heic'})),/HEIC/);
await assert.rejects(images.prepareGearPhoto(new File([],'x.png',{type:'image/png'})));
console.log('PASS: real preparation produces original/cutout PNGs, retains alpha, bounds formats/size and releases decoded bitmap');

const owner='11111111-1111-4111-8111-111111111111', request='22222222-2222-4222-8222-222222222222';
let account=owner,lost=true,writes=0,bytesType;
const objects=new Map();
const supabase={auth:{getSession:async()=>({data:{session:{user:{id:account}}}})},storage:{from:bucket=>{
  assert.equal(bucket,'gear-photos');
  return {async upload(path,file,options){writes++;bytesType=options.contentType;assert.equal(options.upsert,false);if(objects.has(path))return{error:{statusCode:'409'}};objects.set(path,file);if(lost){lost=false;return{error:Error('Lost reply')};}return{error:null};},
    async createSignedUrls(paths){return{data:paths.map(path=>({path,signedUrl:'safe:'+path}))};}};
}}};
const gear=load('src/lib/gear.ts',name=>name.endsWith('/images')?images:{supabase});
await assert.rejects(gear.uploadGearPhoto(prepared.cutout,owner,request));
const path=await gear.uploadGearPhoto(prepared.cutout,owner,request);
assert.equal(objects.size,1);assert.ok(path.startsWith(owner+'/'+request+'-'));assert.ok(path.endsWith('.png'));assert.equal(bytesType,'image/png');
account='other';const prior=writes;await assert.rejects(gear.uploadGearPhoto(prepared.cutout,owner,request));assert.equal(writes,prior);
account=owner;await assert.rejects(gear.signedGearPhotoUrls(['other/photo.png'],owner));
assert.equal((await gear.signedGearPhotoUrls([path],owner)).get(path),'safe:'+path);
console.log('PASS: owner-only PNG upload, stable content-hash retry without duplicate/overwrite, wrong-account writes and foreign signing denied');

const jsx=(type,props)=>({type,props});
const logs=load('src/routes/_authenticated/dives/logs.tsx',name=>{
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(name==='@tanstack/react-router')return{createFileRoute:()=>options=>options};
  return new Proxy({},{get:(_,key)=>key});
},{},'\nexport { DivePhoto };');
const tree=logs.DivePhoto({photo:'safe:test',path:owner+'/photo.jpg',index:0,videoOnly:false,ownerId:owner,version:1,pending:false,error:false,reload(){}});
const wrapper=tree.props.children[0];assert.equal(wrapper.props.className,'absolute inset-0');
const media=wrapper.props.children;assert.equal(media.props.className,'h-full w-full');assert.equal(media.props.url,'safe:test');
assert.equal(media.props.path,owner+'/photo.jpg');assert.equal(media.props.cover,true);
assert.ok(!media.props.className.includes('absolute'));
assert.ok(!read('src/components/PassportCommunity.tsx').includes('统计公开帖收到的他人互动'));
assert.ok(!read('src/routes/forum-preview.tsx').includes('<aside className="do-forum-right">'));
assert.ok(read('src/routes/forum-preview.tsx').indexOf('<ForumBlockedAuthors')<read('src/routes/forum-preview.tsx').indexOf('!preview && forumQuery.isPending'));
console.log('PASS: actual log cover has positioned full-height wrapper without conflicting positioning classes; requested copy/sidebar removed and compact manager moved into tabs');
