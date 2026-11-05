// Actual Updates UI, deterministic catalogue and mutation transport; never touches a backend.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from 'vite';
import { chromium } from 'playwright';

const dir='scripts/.shots';fs.mkdirSync(dir,{recursive:true});
const entry=`${dir}/updates-ui-fixture.tsx`;
fs.writeFileSync(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';import '../../src/app/globals.css';
import {UpdatesPage} from '../../src/modules/watching/components/updates/UpdatesPage';
const base={tmdb_id:42,type:'serie',poster_url:'https://image.tmdb.org/t/p/w500/art.jpg',backdrop_url:'/art.svg',watched:false,in_progress:true,paused:false,dropped:false,want_to_watch:false,is_reference:false,favorite:false,status:'ongoing',current_season:1,current_episode:10,season_episodes:[10,8],season_aired:[10,3],season_air_dates:['2020-01-01','2026-10-01']};
const future=new Date();future.setFullYear(future.getFullYear()+1);const year=future.getFullYear();
const recent=new Date().toISOString().slice(0,10);
window.fixture={calls:[],mode:'ready',data:{items:[{...base,id:'north',title:'Northbound',in_progress:false,resume_required:true},{...base,id:'anime',type:'anime',title:'Ember Chronicle'},{...base,id:'extra1',title:'Second Horizon'},{...base,id:'extra2',title:'Winter Lights'},{...base,id:'wish',title:'Watchlist Premiere',want_to_watch:true,in_progress:false,current_episode:0},{...base,id:'extra3',title:'Fresh Chapter'},{...base,id:'future',tmdb_id:43,title:'The Glass Harbour',season_aired:[10,0],season_air_dates:[null,year+'-03-12']},{...base,id:'future2',tmdb_id:46,want_to_watch:true,in_progress:false,current_episode:0,title:'The Long Journey Across The Northern Sea',season_aired:[10,0],season_air_dates:[null,year+'-03-15']},{...base,id:'future3',tmdb_id:47,title:'Silver Dawn',season_aired:[10,0],season_air_dates:[null,year+'-03-18']},{...base,id:'future4',tmdb_id:48,title:'After The Rain',season_aired:[10,0],season_air_dates:[null,year+'-03-20']},{...base,id:'tba',tmdb_id:44,want_to_watch:true,in_progress:false,current_episode:0,title:'A Story Without A Date',season_aired:[10,0],season_air_dates:[null,null]},{...base,id:'paused',title:'Paused story',paused:true,in_progress:false},{...base,id:'paused-tba',tmdb_id:45,title:'The Gentlemen',paused:true,in_progress:false,season_aired:[10,0],season_air_dates:[null,null]}],cours:[],catalogues:[{work_key:'tv:42',facts:{seasons:[{id:2,number:2,announced:8,aired:3,episodes:[1,2,3].map(n=>({id:n,number:n,aired:true,air_date:recent}))}]}}]}};
createRoot(document.getElementById('root')).render(<UpdatesPage userId="fixture"/>);
`);
const hooks=`import {useSyncExternalStore} from 'react';let version=0;window.setFixtureMode=mode=>{window.fixture.mode=mode;version++;window.dispatchEvent(new Event('fixture'))};export function useWatchingUpdates(){useSyncExternalStore(fn=>{window.addEventListener('fixture',fn);return()=>window.removeEventListener('fixture',fn)},()=>version);const mode=window.fixture.mode;return {isPending:mode==='pending',isError:mode==='error',data:mode==='pending'||mode==='error'?undefined:mode==='empty'?{items:[],cours:[],catalogues:[]}:window.fixture.data,refetch:()=>window.setFixtureMode('ready')}};`;
const mocks={
  '/useWatchingUpdates':hooks,
  '/usePrefetchMedia':`export const usePrefetchMedia=()=>()=>{};`,
  '/useWatchActions':`export const useWatchActions=()=>({resumeItem:async m=>{window.fixture.calls.push(['resume',m.id]);return {in_progress:true}}});`,
  'next/navigation':`export const useRouter=()=>({push:url=>window.fixture.calls.push(['navigate',url])});`,
  '/useAnimeCours':'export const useAnimeCours=()=>({data:[]});',
  '/useImdbId':'export const useImdbId=()=>({data:null});',
  '/useOmdbRatings':'export const useOmdbRatings=()=>({data:null});',
  '/useAgeRating':'export const useAgeRating=()=>({data:null});',
};
const built=await build({configFile:false,resolve:{alias:{'@':path.resolve('src')}},plugins:[{name:'fixture',enforce:'pre',resolveId(id){const key=Object.keys(mocks).find(k=>id===k||id.endsWith(k));return key?'\0fixture:'+key:null;},load(id){return id.startsWith('\0fixture:')?mocks[id.slice(9)]:null;}}],build:{write:false,minify:true,rollupOptions:{input:path.resolve(entry),output:{format:'iife'}}},logLevel:'error'});
const css=built.output.filter(c=>c.type==='asset'&&c.fileName.endsWith('.css')).map(c=>c.source).join('\n');
const js=built.output.find(c=>c.type==='chunk').code;
const html=`<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0;background:#09090b;color:#eee;font-family:Arial}</style><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></html>`;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#2f555c"/><circle cx="200" cy="200" r="130" fill="#cdbb92"/></svg>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.svg')?'image/svg+xml':'text/html');res.end(req.url.endsWith('.svg')?svg:html);}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch();const report=[];
try {for(const width of [390,768,1024,1440]) {
  const page=await browser.newPage({viewport:{width,height:1100},hasTouch:width<1440,deviceScaleFactor:width===390?3:2});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://image.tmdb.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('heading',{name:'Available now',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-image-reveal]')?.dataset.imageReveal!=='pending');
  assert.equal(await page.getByRole('heading',{name:'Updates',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Include paused & dropped',exact:true}).count(),0);
  assert.equal(await page.getByRole('heading',{name:/March \d{4}/}).count(),0);
  assert.equal(await page.getByText('The Gentlemen',{exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:/View details/}).count(),0);
  await page.getByRole('button',{name:'Anime',exact:true}).click();
  assert.equal(await page.getByText('Northbound',{exact:true}).filter({visible:true}).count(),0);
  await page.getByRole('button',{name:'All',exact:true}).click();
  await page.getByRole('button',{name:'Continue watching Ember Chronicle',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[['navigate','/perso/watching/anime']]);
  await page.evaluate(()=>window.fixture.calls=[]);
  await page.getByRole('button',{name:'Resume watching Northbound',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.calls.length===2);
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[['resume','north'],['navigate','/perso/watching/north']]);
  assert.ok(await page.getByRole('link',{name:'View Watchlist Premiere · Season 2',exact:true}).getAttribute('href'));
  await page.mouse.move(0,0);await page.waitForTimeout(350);
  const cards=page.locator('article').filter({visible:true});
  const first=cards.first();
  const readyShape=await first.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top}));
  if(width>=1024){
    const rail=page.locator('[data-image-reveal] section > div.overflow-x-auto').filter({visible:true});
    const geometry=await rail.evaluate(el=>({width:el.clientWidth,card:el.children[0].offsetWidth,padding:parseFloat(getComputedStyle(el).paddingLeft)*2}));
    const n=width>=1280?5:3;assert.ok(Math.abs(geometry.card-(geometry.width-geometry.padding-(n-1)*16)/n)<1);
    await page.getByRole('button',{name:'Next',exact:true}).first().click();await page.waitForTimeout(400);
    assert.ok(await rail.evaluate(el=>el.scrollLeft>0));
    await page.getByRole('button',{name:'Previous',exact:true}).first().click();await page.waitForTimeout(400);
  }
  await page.getByRole('button',{name:'See all',exact:true}).click();
  await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').locator('article').count(),6);
  await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const announcementShape=await page.locator('[data-announcement]').first().evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,poster:el.querySelector('picture').parentElement.getBoundingClientRect().width}));
  assert.equal(announcementShape.poster,112);
  const announcementRail=page.getByLabel('Coming next releases',{exact:true});
  const aGeometry=await announcementRail.evaluate(el=>({width:el.clientWidth,card:el.children[0].offsetWidth}));
  if(width>=768){const n=width>=1280?4:width>=1024?3:2;assert.ok(Math.abs(aGeometry.card-(aGeometry.width-(n-1)*12)/n)<1);}
  assert.ok((await page.getByLabel('Date to be announced releases',{exact:true}).locator('[data-announcement]').first().innerText()).includes('The Gentlemen'));
  const art = page.locator('[data-announcement] picture img').first();
  assert.ok((await page.locator('[data-announcement] picture source').first().getAttribute('srcset')).includes('w342/art.jpg 3x'));
  await art.evaluate(img=>img.decode());
  assert.ok((await art.evaluate(img=>img.currentSrc)).includes('/w342/'),'Sharp poster source must cover DPR2/3');
  assert.equal(await page.locator('[data-announcement]').first().locator('img').count(),2);
  if(width<1280){await announcementRail.evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'}));assert.ok(await announcementRail.evaluate(el=>el.scrollLeft>0));await announcementRail.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));}

  assert.equal(await page.locator('[data-announcement] button').count(),0);
  if(width===1440){
    const before=await first.boundingBox();await first.hover();await page.waitForTimeout(350);const after=await first.boundingBox();
    assert.ok(Math.abs(after.width/before.width-1.04)<.005);await page.mouse.move(0,0);await page.waitForTimeout(350);
    const art=page.locator('[data-announcement] img').first();const beforeArt=await art.boundingBox();await art.hover();await page.waitForTimeout(250);assert.deepEqual(await art.boundingBox(),beforeArt);await page.mouse.move(0,0);
  }
  await page.screenshot({path:`${dir}/updates-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.setFixtureMode('pending'));
  await page.getByRole('status',{name:'Loading updates'}).waitFor();
  const shapes=await page.locator('[aria-label="Loading updates"] .aspect-video, [aria-label="Loading updates"] .aspect-2\\/3').filter({visible:true}).evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
  assert.ok(shapes.some(s=>Math.abs(s.width-readyShape.width)<1&&Math.abs(s.height-readyShape.height)<1),'Shared carousel skeleton geometry');
  const announcementSkeleton=await page.locator('[data-announcement-skeleton]').first().evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
  assert.ok(Math.abs(announcementShape.width-announcementSkeleton.width)<1);assert.ok(Math.abs(announcementShape.height-announcementSkeleton.height)<1);
  await page.screenshot({path:`${dir}/updates-skeleton-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.setFixtureMode('error'));await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Try again'}).click();
  await page.getByRole('heading',{name:'Available now'}).waitFor();
  await page.evaluate(()=>{window.fixture.data={...window.fixture.data,items:window.fixture.data.items.filter(m=>m.id==='future'||m.id==='tba')};window.setFixtureMode('ready')});
  assert.equal(await page.getByRole('heading',{name:'Available now',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'All',exact:true}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Coming next',exact:true}).count(),1);
  await page.evaluate(()=>window.setFixtureMode('empty'));assert.equal(await page.getByRole('heading',{name:'Available now',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'All',exact:true}).count(),1);
  assert.equal(errors.length,0,errors.join('\n'));report.push({width,readyShape,announcementShape,errors});await page.close();
}} finally {await browser.close();server.closeAllConnections();server.close();}
fs.writeFileSync(`${dir}/updates-ui-report.json`,JSON.stringify(report,null,2));
console.log('PASS: Updates four widths, poster tokens, filtering, suspended opt-in, resume/navigation, loading/error/retry/empty states.');
