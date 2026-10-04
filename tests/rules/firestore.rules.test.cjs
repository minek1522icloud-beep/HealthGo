'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
}=require('@firebase/rules-unit-testing');

let env;

test.before(async()=>{
  env=await initializeTestEnvironment({
    projectId:'demo-healthgo',
    firestore:{rules:fs.readFileSync('firebase/firestore.rules','utf8')}
  });
});

test.after(async()=>{await env.cleanup();});
test.beforeEach(async()=>{await env.clearFirestore();});

async function seed(fn){
  await env.withSecurityRulesDisabled(async context=>fn(context.firestore()));
}
function userDb(uid){return env.authenticatedContext(uid,{email:uid+'@example.invalid'}).firestore();}
function anonDb(){return env.unauthenticatedContext().firestore();}

test('owner can read own user document but another user cannot',async()=>{
  await seed(async db=>{
    await db.collection('users').doc('alice').set({accountType:'standard',profile:{nickname:'Alice'}});
  });
  await assertSucceeds(userDb('alice').collection('users').doc('alice').get());
  await assertFails(userDb('bob').collection('users').doc('alice').get());
  await assertFails(anonDb().collection('users').doc('alice').get());
});

test('client cannot forge engine XP or reward ledger',async()=>{
  await seed(async db=>{
    await db.collection('users').doc('alice').set({accountType:'standard'});
    await db.collection('users').doc('alice').collection('engine').doc('state').set({schemaVersion:2,totalXp:10});
  });
  await assertFails(userDb('alice').collection('users').doc('alice').collection('engine').doc('state').set({schemaVersion:2,totalXp:999999}));
  await assertFails(userDb('alice').collection('users').doc('alice').collection('rewardLedger').doc('fake').set({xp:999999}));
});

test('owner can sync bounded health data but cannot write absurd metrics',async()=>{
  await seed(async db=>{await db.collection('users').doc('alice').set({accountType:'standard'});});
  const ref=userDb('alice').collection('users').doc('alice').collection('health').doc('latest');
  await assertSucceeds(ref.set({
    steps:8200,
    distanceKm:6.1,
    activeMinutes:44,
    heartRate:78,
    sleepMinutes:470,
    source:'Android · Health Connect',
    device:'Phone',
    updatedAt:new Date().toISOString()
  }));
  await assertFails(ref.set({
    steps:900000,
    source:'fake',
    device:'fake',
    updatedAt:new Date().toISOString()
  }));
  await assertFails(userDb('bob').collection('users').doc('alice').collection('health').doc('latest').set({steps:1}));
});

test('client root writes are limited to planning/settings fields',async()=>{
  const own=userDb('alice').collection('users').doc('alice');
  await assertSucceeds(own.set({plan:[],settingsV3:{theme:'dark'},updatedAt:new Date().toISOString()}));
  await assertFails(own.set({accountType:'guardian',profile:{nickname:'Injected'}}));
  await seed(async db=>{await db.collection('users').doc('alice').set({accountType:'standard',profile:{nickname:'Alice'}},{merge:true});});
  await assertSucceeds(own.update({plan:[{id:'p1',title:'Plan'}],updatedAt:new Date().toISOString()}));
  await assertFails(own.update({accountType:'child'}));
});

test('outsider cannot read a family or child shared data',async()=>{
  await seed(async db=>{
    await db.collection('families').doc('fam1').set({createdBy:'guardian'});
    await db.collection('families').doc('fam1').collection('members').doc('guardian').set({uid:'guardian',role:'guardian'});
    await db.collection('families').doc('fam1').collection('members').doc('child').set({uid:'child',role:'child'});
    await db.collection('families').doc('fam1').collection('shared').doc('child').collection('activity').doc('latest').set({steps:5000});
  });
  await assertFails(userDb('outsider').collection('families').doc('fam1').get());
  await assertFails(userDb('outsider').collection('families').doc('fam1').collection('shared').doc('child').collection('activity').doc('latest').get());
});

test('guardian sees child activity only with explicit HEALTH_ACTIVITY permission',async()=>{
  await seed(async db=>{
    const fam=db.collection('families').doc('fam1');
    await fam.set({createdBy:'guardian'});
    await fam.collection('members').doc('guardian').set({uid:'guardian',role:'guardian'});
    await fam.collection('members').doc('child').set({uid:'child',role:'child'});
    await fam.collection('permissions').doc('guardian_child').set({
      guardianUid:'guardian',
      childUid:'child',
      scopes:{HEALTH_ACTIVITY:false,LOCATION_APPROXIMATE:false,LOCATION_PRECISE:false}
    });
    await fam.collection('shared').doc('child').collection('activity').doc('latest').set({steps:5000});
  });
  const ref=userDb('guardian').collection('families').doc('fam1').collection('shared').doc('child').collection('activity').doc('latest');
  await assertFails(ref.get());
  await seed(async db=>{
    await db.collection('families').doc('fam1').collection('permissions').doc('guardian_child').update({'scopes.HEALTH_ACTIVITY':true});
  });
  await assertSucceeds(ref.get());
});

test('approximate permission never grants precise child location',async()=>{
  await seed(async db=>{
    const fam=db.collection('families').doc('fam1');
    await fam.set({createdBy:'guardian'});
    await fam.collection('members').doc('guardian').set({uid:'guardian',role:'guardian'});
    await fam.collection('members').doc('child').set({uid:'child',role:'child'});
    await fam.collection('permissions').doc('guardian_child').set({
      guardianUid:'guardian',
      childUid:'child',
      scopes:{LOCATION_APPROXIMATE:true,LOCATION_PRECISE:false}
    });
    await fam.collection('locations').doc('child').collection('samples').doc('approximate').set({latitude:50.81,longitude:19.12,mode:'approximate'});
    await fam.collection('locations').doc('child').collection('samples').doc('precise').set({latitude:50.8123,longitude:19.1234,mode:'precise'});
  });
  const base=userDb('guardian').collection('families').doc('fam1').collection('locations').doc('child').collection('samples');
  await assertSucceeds(base.doc('approximate').get());
  await assertFails(base.doc('precise').get());
});

test('precise permission grants precise and approximate family location',async()=>{
  await seed(async db=>{
    const fam=db.collection('families').doc('fam1');
    await fam.set({createdBy:'guardian'});
    await fam.collection('members').doc('guardian').set({uid:'guardian',role:'guardian'});
    await fam.collection('members').doc('child').set({uid:'child',role:'child'});
    await fam.collection('permissions').doc('guardian_child').set({
      guardianUid:'guardian',
      childUid:'child',
      scopes:{LOCATION_APPROXIMATE:false,LOCATION_PRECISE:true}
    });
    await fam.collection('locations').doc('child').collection('samples').doc('approximate').set({latitude:50.81,longitude:19.12,mode:'approximate'});
    await fam.collection('locations').doc('child').collection('samples').doc('precise').set({latitude:50.8123,longitude:19.1234,mode:'precise'});
  });
  const base=userDb('guardian').collection('families').doc('fam1').collection('locations').doc('child').collection('samples');
  await assertSucceeds(base.doc('approximate').get());
  await assertSucceeds(base.doc('precise').get());
});

test('child can read own family location but not another child location',async()=>{
  await seed(async db=>{
    const fam=db.collection('families').doc('fam1');
    await fam.set({createdBy:'guardian'});
    await fam.collection('members').doc('child').set({uid:'child',role:'child'});
    await fam.collection('members').doc('other').set({uid:'other',role:'child'});
    await fam.collection('locations').doc('child').collection('samples').doc('approximate').set({latitude:50.81,longitude:19.12,mode:'approximate'});
    await fam.collection('locations').doc('other').collection('samples').doc('approximate').set({latitude:50.82,longitude:19.13,mode:'approximate'});
  });
  const base=userDb('child').collection('families').doc('fam1').collection('locations');
  await assertSucceeds(base.doc('child').collection('samples').doc('approximate').get());
  await assertFails(base.doc('other').collection('samples').doc('approximate').get());
});

test('family invite tokens are never readable directly by clients',async()=>{
  await seed(async db=>{await db.collection('familyInvites').doc('hash').set({familyId:'fam1',used:false});});
  await assertFails(userDb('guardian').collection('familyInvites').doc('hash').get());
});

test('notification client may only mark its own notification read',async()=>{
  await seed(async db=>{
    await db.collection('users').doc('alice').set({accountType:'standard'});
    await db.collection('users').doc('alice').collection('notifications').doc('n1').set({title:'Test',message:'Hello',read:false,createdAt:new Date().toISOString()});
  });
  const own=userDb('alice').collection('users').doc('alice').collection('notifications').doc('n1');
  await assertSucceeds(own.update({read:true,readAt:new Date().toISOString()}));
  await assertFails(own.update({message:'changed'}));
  await assertFails(userDb('bob').collection('users').doc('alice').collection('notifications').doc('n1').update({read:true}));
});
