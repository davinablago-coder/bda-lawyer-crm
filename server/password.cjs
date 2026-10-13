const {randomBytes,scrypt:rawScrypt,timingSafeEqual}=require('node:crypto');
const scrypt=require('node:util').promisify(rawScrypt);
async function hashPassword(password){
  if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Пароль должен содержать от 12 до 256 символов');
  const salt=randomBytes(16).toString('hex');
  return salt+':'+(await scrypt(password,salt,64)).toString('hex');
}
async function verifyPassword(password,encoded){
  const [salt,key]=encoded.split(':');
  const actual=await scrypt(password,salt,64);const expected=Buffer.from(key,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
module.exports={hashPassword,verifyPassword};
