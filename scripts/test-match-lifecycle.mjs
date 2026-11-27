import test from 'node:test';import assert from 'node:assert/strict';import {matchAvailability} from '../lib/match-lifecycle.js';
const now=Date.parse('2026-11-27T06:00:00Z'),cfg={active:true,match_seconds:90,starts_at:null,ends_at:null};
test('published campaign is open',()=>assert.equal(matchAvailability(cfg,now),'open'));
test('draft and finalized are distinct',()=>{assert.equal(matchAvailability({...cfg,active:false},now),'unpublished');assert.equal(matchAvailability({...cfg,active:false,match_finalized_at:new Date(now).toISOString()},now),'finalized')});
test('future scheduled campaign is published but not open',()=>assert.equal(matchAvailability({...cfg,starts_at:new Date(now+60000).toISOString()},now),'scheduled'));
test('closing vs ended',()=>{assert.equal(matchAvailability({...cfg,ends_at:new Date(now+89000).toISOString()},now),'closing');assert.equal(matchAvailability({...cfg,ends_at:new Date(now+90000).toISOString()},now),'open');assert.equal(matchAvailability({...cfg,ends_at:new Date(now).toISOString()},now),'ended')});
