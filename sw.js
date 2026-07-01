const CACHE_PREFIX='scope-static-';
const CACHE_VERSION='v12';
const CACHE=`${CACHE_PREFIX}${CACHE_VERSION}`;
const ASSETS=['./','./index.html','./styles.css','./cloud.css','./security-utils.js','./app.js','./supabase.min.js','./supabase-config.js','./supabase-sync.js','./manifest.webmanifest','./scope-icon.svg','./pdf.min.js','./pdf.worker.min.js','./mammoth.browser.min.js'];
const APPROVED_URLS=new Set(ASSETS.map(asset=>new URL(asset,self.location.href).href));

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key!==CACHE&&(key.startsWith(CACHE_PREFIX)||key.startsWith('scope-')))
    .map(key=>caches.delete(key))
  )).then(()=>self.clients.claim())
));

function approvedStaticRequest(request){
  if(request.method!=='GET')return false;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return false;
  if(url.search)return false;
  if(request.headers.has('authorization'))return false;
  return APPROVED_URLS.has(url.href);
}

function cacheableStaticResponse(response){
  if(!response||!response.ok||response.type!=='basic')return false;
  const control=(response.headers.get('cache-control')||'').toLowerCase();
  const vary=(response.headers.get('vary')||'').toLowerCase();
  return !control.includes('private')&&!control.includes('no-store')&&!vary.includes('authorization')&&!vary.includes('cookie')&&!response.headers.has('set-cookie');
}

self.addEventListener('fetch',event=>{
  if(!approvedStaticRequest(event.request))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(cacheableStaticResponse(response)){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
    }
    return response;
  }).catch(()=>caches.match(event.request)));
});
