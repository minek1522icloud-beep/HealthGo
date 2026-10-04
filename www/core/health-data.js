(function(root,factory){
'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HealthGoData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function number(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;}
function timestamp(v){
 if(v==null)return null;
 if(typeof v.toMillis==='function')return v.toMillis();
 if(typeof v.toDate==='function')return v.toDate().getTime();
 if(typeof v==='object'&&typeof v.seconds==='number')return v.seconds*1000+(v.nanoseconds||0)/1e6;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;
}
function normalize(raw){
 if(!raw||typeof raw!=='object')return null;
 const out={schemaVersion:raw.schemaVersion||1};
 for(const field of ['steps','distanceKm','activeMinutes','heartRate','sleepMinutes'])out[field]=number(raw[field]);
 for(const field of ['source','sourceId','device','deviceId','syncId','day','timeZone'])out[field]=typeof raw[field]==='string'?raw[field].slice(0,180):null;
 out.timestamp=timestamp(raw.timestamp||raw.observedAt);
 out.updatedAt=timestamp(raw.updatedAt||raw.syncedAt);
 out.heartRateMeasuredAt=timestamp(raw.heartRateMeasuredAt);
 out.available=Object.keys(out).filter(k=>['steps','distanceKm','activeMinutes','heartRate','sleepMinutes'].includes(k)&&out[k]!==null);
 return out;
}
function coarsenLocation(coords){
 if(!coords||!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude)||Math.abs(coords.latitude)>90||Math.abs(coords.longitude)>180)throw new TypeError('Invalid coordinates');
 const latitude=Math.round(coords.latitude*100)/100,longitude=Math.round(coords.longitude*100)/100;
 return {latitude,longitude,accuracyMeters:Math.max(1500,number(coords.accuracyMeters)||0),mode:'approximate'};
}
function locationStatus(record,settings,online,now){
 if(!settings||!['approximate','precise'].includes(settings.mode)||settings.enabled===false)return 'DISABLED';
 if(settings.permissionRequired)return 'PERMISSION_REQUIRED';
 if(online===false)return 'OFFLINE';
 const ms=timestamp(record&&(record.timestamp||record.updatedAt));
 if(ms===null)return 'NO_DATA';
 const age=(now===undefined?Date.now():now)-ms;
 if(age<0||age>15*60000)return 'STALE';
 return age<=30000?'LIVE':'RECENT';
}
return {number,timestamp,normalize,coarsenLocation,locationStatus};
});
