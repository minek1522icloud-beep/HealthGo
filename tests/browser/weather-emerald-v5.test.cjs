'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const base=path.resolve('www');
 server=http.createServer((req,res)=>{
  const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return}
  try{
   res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
for(const width of [360,390,430,1024]){
 test('Weather city, 12-hour and 7-day real-source UI works at '+width+'px',async()=>{
  const page=await browser.newPage({viewport:{width,height:860}});
  const t=new Date('2026-10-10T10:00:00Z');
  const times=Array.from({length:24},(_,i)=>new Date(t.getTime()+i*3600000).toISOString().slice(0,16));
  const forecast={
   current:{temperature_2m:19.3,apparent_temperature:17.2,relative_humidity_2m:62,
    surface_pressure:1013,wind_speed_10m:15,wind_direction_10m:90,precipitation:0.2,
    weather_code:2,time:'2026-10-10T10:00'},
   hourly:{time:times,temperature_2m:times.map((_,i)=>19+i/5),
    precipitation_probability:times.map((_,i)=>i*3),weather_code:times.map(()=>2),uv_index:times.map(()=>3)},
   daily:{
    time:Array.from({length:7},(_,i)=>new Date(t.getTime()+i*86400000).toISOString().slice(0,10)),
    temperature_2m_max:Array(7).fill(23),temperature_2m_min:Array(7).fill(11),
    weather_code:Array(7).fill(2),precipitation_probability_max:Array(7).fill(37),
    uv_index_max:[3.6,...Array(6).fill(3)],sunrise:Array(7).fill('2026-10-10T06:22'),
    sunset:Array(7).fill('2026-10-10T18:03')
   }
  };
  await page.route('https://**/*',route=>route.abort());
  await page.route('https://nominatim.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{lat:'50.0614',lon:'19.9366',display_name:'Kraków, Polska'}])}));
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(forecast)}));
  await page.addInitScript(()=>localStorage.setItem('healthgo.location.welcome.v1','later'));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!window.HealthGoMap4);
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'weather-fixture',email:'weather@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(e=>e.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   window.go('map');
   window.HealthGoMapV2.toggle('weather');
  });
  await page.locator('#hg5WeatherCity').fill('Kraków');
  await page.locator('#hg5WeatherSearchButton').click();
  await page.waitForFunction(()=>document.querySelector('#hg4WeatherCurrent')?.textContent.includes('19°C'));
  assert.match(await page.locator('#hg4WeatherCurrent').innerText(),/Kraków, Polska/);
  assert.equal(await page.locator('#hg5WeatherDetails .hg5-weather-stat').count(),6);
  assert.match(await page.locator('#hg5WeatherDetails').innerText(),/1013 hPa/);
  assert.match(await page.locator('#hg5WeatherDetails').innerText(),/3,6/);
  assert.match(await page.locator('#hg5WeatherDetails').innerText(),/06:22/);
  assert.equal(await page.locator('#hg4WeatherHours .hg4-hour').count(),12);
  assert.equal(await page.locator('#hg4WeatherDaily .hg4-day').count(),7);
  const size=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   client:document.documentElement.clientWidth,
   panelColor:getComputedStyle(document.querySelector('#map .hg4-weather-card')).backgroundColor
  }));
  assert.ok(size.scroll<=size.client+1,'Weather page overflows: '+JSON.stringify(size));
  assert.notEqual(size.panelColor,'rgb(255, 255, 255)');

  // Missing API measurements must not turn into 0°C or 0 hPa.
  forecast.current.surface_pressure=null;
  forecast.daily.uv_index_max=[null,...Array(6).fill(3)];
  await page.evaluate(()=>HealthGoMap4.refreshWeather());
  await page.waitForFunction(()=>document.querySelector('#hg5WeatherDetails')?.textContent.includes('—'));
  assert.match(await page.locator('#hg5WeatherDetails').innerText(),/Ciśnienie\s+—/);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
