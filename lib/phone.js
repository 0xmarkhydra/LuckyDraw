// Canonical Vietnamese mobile number (E.164). Empty string means invalid.
export function normalizePhone(value){
 if(typeof value!=='string')return '';
 const compact=value.trim().replace(/[\s().-]/g,'');
 const match=/^(?:0|\+?84)([35789]\d{8})$/.exec(compact);
 return match?'+84'+match[1]:'';
}
// Keep v2 recovery keys and v11 short-lived quotas stable across the migration.
export function legacyPhoneKey(value){const phone=normalizePhone(value);return phone?'0'+phone.slice(3):''}
