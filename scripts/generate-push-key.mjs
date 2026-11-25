// stdout is PRIVATE. Pipe directly to wrangler secret put or a protected file.
import {generateKeyPairSync} from 'node:crypto';
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
process.stdout.write(JSON.stringify(privateKey.export({format:'jwk'}))+'\n');
