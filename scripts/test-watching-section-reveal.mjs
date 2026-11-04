// Browser regression: real section gate/carousel/skeleton, controlled image transport, no backend.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from 'vite';
import { chromium } from 'playwright';

const artifacts = 'scripts/.shots';
fs.mkdirSync(artifacts, { recursive: true });
const entry = `${artifacts}/section-reveal-regression.tsx`;
fs.writeFileSync(entry, `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import '../../src/app/globals.css';
import {SectionImageReveal} from '../../src/modules/watching/components/shared/SectionImageReveal';
import {MediaCarousel} from '../../src/modules/watching/components/shared/MediaCarousel';
import {CarouselSkeleton} from '../../src/modules/watching/components/shared/WatchingSkeletons';
import ForYou from '../../src/modules/watching/components/sections/ForYouSectionClient';
import DontMiss from '../../src/modules/watching/components/sections/DontMissSectionClient';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StatusCard} from '../../src/modules/watching/components/detail/StatusCard';
import {buildMediaView} from '../../src/modules/watching/lib/media-view';
const queryClient=new QueryClient();
const items=Array.from({length:10},(_,i)=>({id:String(i),title:'Fixture '+i,type:'film',poster_url:'/art/'+i+'.svg',backdrop_url:'/art/'+i+'.svg',watched:true,watched_at:'2026-10-20',tags:['Drama']}));
function App(){const [version,setVersion]=useState(0),[refresh,setRefresh]=useState(0),[state,setState]=useState('ongoing');window.rerender=()=>setRefresh(n=>n+1);window.remount=()=>setVersion(n=>n+1);window.switchState=setState;
const media={id:'fixture',title:'Series',type:'serie',status:state==='completed'?'ended':'ongoing',season_episodes:[12],season_aired:[12],current_season:1,current_episode:state==='caught'||state==='completed'?12:11,in_progress:state!=='completed'&&state!=='paused',watched:state==='completed',paused:state==='paused',watched_at:'2026-10-20',season_years:{1:2026}};const view=buildMediaView(media,null);const noop=()=>{};
return <main className="p-4 sm:p-6"><div id="actual" key={version}><MediaCarousel title="Last Watched" subtitle="The last 10 films you watched" items={items.map(i=>({...i,title:i.title+' '+refresh}))} onAddClick={()=>{}}/></div>
<div id="shape"><CarouselSkeleton title="Last Watched" subtitle="The last 10 films you watched"/></div>
<div id="independent"><SectionImageReveal fallback={<div>Loading independent</div>}><img width="40" height="40" src="/fast.svg"/></SectionImageReveal></div>
<div id="deadline"><SectionImageReveal fallback={<div>Loading slow</div>}><img width="40" height="40" src="/deadline.svg"/></SectionImageReveal></div>
<div id="failure"><SectionImageReveal fallback={<div>Loading broken</div>}><img width="40" height="40" src="/broken.svg"/></SectionImageReveal></div>
<div id="for-you"><ForYou userId="fixture" config={{type:'film',labelPlural:'films'}}/></div><div id="dont-miss"><DontMiss config={{type:'film',labelPlural:'films'}}/></div>
<aside className="max-w-sm"><StatusCard media={media} view={view} isSeries currentSeason={1} currentEpisode={media.current_episode} favorite={false} onFavoriteToggle={noop} onUpdateProgress={noop} onCorrectPosition={noop} onMarkWatched={noop} onMarkCaughtUp={noop} onStartWatching={noop} onPause={noop} onDrop={noop} onResume={noop} onAddNote={noop} onSeasonYearChange={noop} onWatchedDateChange={noop} onPriorityChange={noop} onDelete={noop}/></aside></main>};
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><App/></QueryClientProvider>);
`);
const mocks = {
  'next/navigation': 'export const useRouter=()=>({push(){}});',
  '/usePrefetchMedia': 'export const usePrefetchMedia=()=>()=>{};',
  '/useMediaView': 'export const useMediaViews=()=>new Map();',
  '/MediaActionMenu': 'export const MediaActionMenu=()=>null;',
  '/NextEpisodeButton': 'export const NextEpisodeButton=()=>null;',
  '/useAnimeCours': 'export const useAnimeCours=()=>({data:[]});',
  '/useImdbId': 'export const useImdbId=()=>({data:null});',
  '/useOmdbRatings': 'export const useOmdbRatings=()=>({data:null});',
  '/useAgeRating': 'export const useAgeRating=()=>({data:null});',
  '/WatchingClient': 'export const useWatching=()=>({openTitle(){}});',
  '/useCurrentUserId': 'export const useCurrentUserId=()=>"fixture";',
  '/useOwnedTmdbIds': 'export const useOwnedTmdbIds=()=>({data:[],isLoading:false});export const useOwnedMediaIds=()=>({data:{}});',
  '/useForYouRecommendations': 'const data=Array.from({length:10},(_,i)=>({id:i,title:"Recommendation "+i,poster_path:"/fixture.svg",backdrop_path:"/fixture.svg",vote_average:8}));export const useForYouRecommendations=()=>({data,isLoading:false});export const useForYouDismissals=()=>({data:[],isLoading:false});export const useDismissForYou=()=>({mutate(){}});',
  '/useWatchingHero': 'const items=Array.from({length:6},(_,i)=>({id:i,title:"Trending "+i,poster_path:"/fixture.svg",vote_average:8,genre_ids:[]}));export const useWatchingHero=()=>({data:{trending:items[0],recommendations:items.slice(1)}});',
  '/useQuickAdd': 'export const useQuickAdd=()=>({addByTmdb:async()=>({id:"fixture"})});',
  '/useMediaHistory': 'export const useMediaHistory=()=>({data:{records:[]},isPending:false});',
  '/useRewatches': 'export const useRewatches=()=>({data:[]});export const useAddRewatch=()=>({isPending:false});export const useRemoveRewatch=()=>({isPending:false});',
};
const built = await build({configFile:false,resolve:{alias:{'@':path.resolve('src')}},plugins:[{
  name:'read-only-fixture',enforce:'pre',resolveId(id,importer){if(importer?.endsWith('RewatchForm.tsx')&&id==='../../service')return '\0catalogue';if(importer?.endsWith('ForYouSectionClient.tsx')&&id.endsWith('/service'))return '\0dismiss';const key=Object.keys(mocks).find(k=>id===k||id.endsWith(k));if(key)return '\0mock:'+key;},load(id){if(id==='\0catalogue')return 'export const getRewatchCatalogue=async()=>({seasons:[],cours:[]});';if(id==='\0dismiss')return 'export const dismissForYou=async()=>{};';if(id.startsWith('\0mock:'))return mocks[id.slice(6)];},
}],build:{write:false,minify:true,rollupOptions:{input:path.resolve(entry),output:{format:'iife'}}},logLevel:'error'});
const css=built.output.filter(c=>c.type==='asset'&&c.fileName.endsWith('.css')).map(c=>c.source).join('\n');
const script=built.output.find(c=>c.type==='chunk').code;
const html=`<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0;background:#09090b;color:#eee;font-family:Arial}#shape{margin-top:24px}#independent,#deadline,#failure{position:fixed;bottom:0;left:0;z-index:-1}</style><div id="root"></div><script>${script.replaceAll('</script','<\\/script')}</script></html>`;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#406b72"/><circle cx="300" cy="280" r="150" fill="#d9cba7"/></svg>';
const timers=new Set();
const server=http.createServer((req,res)=>{
  if(req.url==='/' ){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(req.url==='/broken.svg'){res.writeHead(404);res.end();return;}
  const delay=req.url==='/deadline.svg'?4000:req.url==='/fast.svg'?50:req.url.includes('/4.svg')?650:120;
  const timer=setTimeout(()=>{timers.delete(timer);res.setHeader('Cache-Control','public, max-age=3600');res.setHeader('Content-Type','image/svg+xml');res.end(svg);},delay);timers.add(timer);
}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch();
const report=[];
try {
  for(const width of [390,768,1024,1440]) {
    const page=await browser.newPage({viewport:{width,height:1100},hasTouch:width<1440});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://image.tmdb.org/**',async route=>{await new Promise(resolve=>setTimeout(resolve,180));await route.fulfill({contentType:'image/svg+xml',body:svg});});
    await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#actual [data-image-reveal]');
    await page.evaluate(()=>{window.framesSeen=[];window.sampling=true;function frame(){const root=document.querySelector('#actual [data-image-reveal]');window.framesSeen.push({phase:root.dataset.imageReveal,opacity:+getComputedStyle(root.firstElementChild).opacity});if(window.sampling)requestAnimationFrame(frame)}frame()});
    await page.waitForFunction(()=>document.querySelector('#independent [data-image-reveal]').dataset.imageReveal!=='pending');
    // Another section's slow/failing image cannot hold the first section hostage.
    assert.equal(await page.locator('#deadline [data-image-reveal]').getAttribute('data-image-reveal'),'pending');
    await page.waitForFunction(()=>document.querySelector('#actual [data-image-reveal]').dataset.imageReveal!=='pending');
    await page.waitForTimeout(200);
    const shape=await page.evaluate(()=>{
      window.sampling=false;
      const real=document.querySelector('#actual section'),sk=document.querySelector('#shape > div');
      const visible=el=>el.getBoundingClientRect().width>0;
      const row=[...real.children].slice(1).find(visible);
      const skeletonRow=[...sk.children].slice(1).find(visible);
      const card=row.firstElementChild.getBoundingClientRect(),cell=skeletonRow.firstElementChild.getBoundingClientRect();
      return {height:real.getBoundingClientRect().height,skeletonHeight:sk.getBoundingClientRect().height,cardWidth:card.width,skeletonWidth:cell.width,cardOffset:card.top-real.getBoundingClientRect().top,skeletonOffset:cell.top-sk.getBoundingClientRect().top,frames:window.framesSeen,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(Math.abs(shape.cardWidth-shape.skeletonWidth)<1,JSON.stringify({width,shape}));
    assert.ok(Math.abs(shape.cardOffset-shape.skeletonOffset)<1,JSON.stringify({width,shape}));
    assert.ok(Math.abs(shape.height-shape.skeletonHeight)<1,JSON.stringify({width,shape}));
    assert.equal(shape.overflow,false);
    assert.ok(shape.frames.every(f=>f.phase!=='pending'||f.opacity===0));
    await page.evaluate(()=>window.rerender());
    assert.notEqual(await page.locator('#actual [data-image-reveal]').getAttribute('data-image-reveal'),'pending');
    await page.evaluate(()=>window.remount());
    await page.waitForFunction(()=>document.querySelector('#actual [data-image-reveal]').dataset.imageReveal==='instant');
    await page.waitForFunction(()=>document.querySelector('#failure [data-image-reveal]').dataset.imageReveal!=='pending');
    await page.waitForFunction(()=>document.querySelector('#deadline [data-image-reveal]').dataset.imageReveal!=='pending');
    const extra=[];
    for(const id of ['for-you','dont-miss']) {
      await page.locator('#'+id).scrollIntoViewIfNeeded();
      await page.waitForFunction(id=>document.querySelector('#'+id+' [data-image-reveal]').dataset.imageReveal!=='pending',id);
      extra.push(await page.evaluate(id=>{
        const root=document.querySelector('#'+id+' [data-image-reveal]');
        return {id,height:root.getBoundingClientRect().height,phase:root.dataset.imageReveal};
      },id));
    }
    await page.locator('[data-status-card]').scrollIntoViewIfNeeded();
    await page.evaluate(()=>{window.statusFrames=[];window.statusSampling=true;function frame(){const card=document.querySelector('[data-status-card]');window.statusFrames.push({height:card.getBoundingClientRect().height,chips:card.querySelectorAll('.watching-status').length});if(window.statusSampling)requestAnimationFrame(frame)}frame();});
    for(const state of ['caught','ongoing','paused','ongoing','completed']) {
      await page.evaluate(state=>window.switchState(state),state);
      await page.waitForTimeout(260);
    }
    const transition=await page.evaluate(()=>{window.statusSampling=false;return window.statusFrames;});
    assert.ok(transition.every(frame=>frame.chips===1),'Overlapping status chips');
    assert.ok(new Set(transition.map(frame=>frame.height.toFixed(1))).size>12,'Height changed without intermediate frames');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.switchState('paused'));
    assert.ok(parseFloat(await page.locator('[data-status-card] .transition-\\[height\\]').evaluate(el=>getComputedStyle(el).transitionDuration))<0.001);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.screenshot({path:`${artifacts}/section-reveal-${width}.png`});
    report.push({width,...shape,frames:shape.frames.length,extra,transitionFrames:transition.length,maxChips:Math.max(...transition.map(f=>f.chips)),errors});
    await page.close();
  }
} finally { await browser.close();for(const timer of timers)clearTimeout(timer);server.closeAllConnections();server.close(); }
fs.writeFileSync(`${artifacts}/section-reveal-report.json`,JSON.stringify(report,null,2));
console.log('PASS: four widths, real carousel/skeleton geometry, independent sections, cold/cache/refetch/error/deadline.');
