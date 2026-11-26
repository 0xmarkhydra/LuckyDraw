import assert from 'node:assert/strict';
import {normalizePhone,legacyPhoneKey} from '../lib/phone.js';
for(const n of ['0901234567','84901234567','+84901234567','+84 901 234 567','090-123-4567']){
 assert.equal(normalizePhone(n),'+84901234567');
 assert.equal(legacyPhoneKey(n),'0901234567');
}
for(const n of ['','+840901234567','1234567890','+849012345678','+6590123456',null])assert.equal(normalizePhone(n),'');
console.log('PASS: VN mobile canonical format, validation and legacy recovery key compatibility');
