import test from 'node:test';
import assert from 'node:assert/strict';
import {exportBackup,parseExportParts,tarHeader} from '../src/backup-export.js';
import {buildSqlBackup,dependencyOrder,literalExpression} from '../src/sql-backup.js';
import {readFileSync} from 'node:fs';
let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const id='12345678-1234-1234-1234-123456789abc',key=`media/${id}.mp4`,data=new Uint8Array([1,2,3,4,5]);
function fixture({missing=false,wrongSize=false}={}){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE z_parent(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
 CREATE TABLE a_child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES z_parent(id), bytes BLOB, text TEXT, n INTEGER, r REAL, calculated INTEGER GENERATED ALWAYS AS (id+1) STORED);
 CREATE TABLE content_items(collection TEXT,id TEXT,position INTEGER,content TEXT);
 CREATE TABLE configuration(name TEXT,content TEXT);
 CREATE TABLE media_files(id TEXT,object_key TEXT,name TEXT,mime_type TEXT,bytes INTEGER);
 CREATE TABLE messages(id TEXT PRIMARY KEY, message TEXT);
 CREATE TABLE message_details(id TEXT REFERENCES messages(id), phone TEXT, archived INTEGER);
 CREATE TABLE message_countries(id TEXT REFERENCES messages(id), phone_country TEXT);
 CREATE TABLE visit_hours(date TEXT,views INTEGER);
 CREATE TABLE auth_attempts(ip_hash TEXT);
 CREATE TABLE future_table(value TEXT);
 CREATE TABLE _cf_KV(key TEXT PRIMARY KEY,value TEXT);
 CREATE INDEX child_parent_idx ON a_child(parent_id);
 CREATE VIEW child_view AS SELECT id,parent_id FROM a_child;
 INSERT INTO z_parent VALUES(5,'parent'); UPDATE sqlite_sequence SET seq=99 WHERE name='z_parent';
 INSERT INTO a_child(id,parent_id,bytes,text,n,r) VALUES(1,5,X'00FF','a'||char(0)||'b',9223372036854775807,1.25);
 INSERT INTO content_items VALUES('projects','draft',0,'{"published":false}');
 INSERT INTO configuration VALUES('settings','{}');
 INSERT INTO messages VALUES('m','it''s private');
 INSERT INTO message_details VALUES('m','+201234567890',1);
 INSERT INTO message_countries VALUES('m','EG');
 INSERT INTO visit_hours VALUES('2026-11-25',2);
 INSERT INTO auth_attempts VALUES('hash'); INSERT INTO future_table VALUES('new');
 INSERT INTO _cf_KV VALUES('internal','excluded');
 CREATE TRIGGER child_trigger AFTER INSERT ON a_child BEGIN INSERT INTO future_table VALUES('trigger'); END;`);
 db.prepare('INSERT INTO media_files VALUES(?,?,?,?,?)').run(id,key,'original video.mp4','video/mp4',data.length);
 const calls=[],files=[];const env={DB:{prepare(sql){calls.push(sql);return {async all(){return {results:db.prepare(sql).all()};}};},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.all());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},FILES:{async get(k){files.push(k);if(missing)return null;return {size:wrongSize?100:data.length,body:new Response(data).body};}}};
 return {env,calls,files,db};
}
function restore(sql){const db=new DatabaseSync(':memory:');db.exec('BEGIN;\n'+sql+'\nCOMMIT;');return db;}
function readTar(buffer){const a=new Uint8Array(buffer),decoder=new TextDecoder(),result=new Map();let at=0;while(at+512<=a.length&&a[at]){const h=a.slice(at,at+512),str=(off,len)=>decoder.decode(h.slice(off,off+len)).split('\0')[0];const expected=parseInt(str(148,8),8);h.fill(32,148,156);assert.equal(h.reduce((n,b)=>n+b,0),expected);const size=parseInt(str(124,12),8);result.set(str(0,100),a.slice(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;}assert.equal(a.length-at,1024);return result;}
test('full SQL round trip preserves real schema, future tables, all message details, exact int64, NUL, blobs, generated columns and sequences',{skip:!DatabaseSync},async()=>{const {env,files,db}=fixture();try{const res=await exportBackup(env,'database');assert.equal(res.status,200);assert.match(res.headers.get('Content-Type'),/application\/sql/);assert.match(res.headers.get('Cache-Control'),/no-store/);const bytes=await res.arrayBuffer();assert.equal(bytes.byteLength,+res.headers.get('X-Export-Bytes'));const sql=new TextDecoder().decode(bytes);assert.ok(sql.indexOf('CREATE TABLE z_parent')<sql.indexOf('CREATE TABLE a_child'));assert.ok(sql.indexOf('INSERT INTO "z_parent"')<sql.indexOf('INSERT INTO "a_child"'));assert.ok(!sql.includes('_cf_KV'));const dst=restore(sql);try{assert.equal(dst.prepare('SELECT phone FROM message_details').get().phone,'+201234567890');assert.equal(dst.prepare('SELECT phone_country FROM message_countries').get().phone_country,'EG');assert.equal(dst.prepare('SELECT content FROM content_items').get().content,'{"published":false}');assert.equal(dst.prepare('SELECT value FROM future_table').get().value,'new');assert.equal(dst.prepare('SELECT count(*) AS n FROM future_table').get().n,1);assert.equal(dst.prepare('SELECT CAST(n AS TEXT) AS n,hex(bytes) AS bytes,hex(text) AS text,calculated,r FROM a_child').get().n,'9223372036854775807');assert.equal(dst.prepare('SELECT hex(text) AS h FROM a_child').get().h,'610062');assert.equal(dst.prepare('SELECT hex(bytes) AS h FROM a_child').get().h,'00FF');assert.equal(dst.prepare('SELECT calculated FROM a_child').get().calculated,2);assert.equal(dst.prepare("SELECT seq FROM sqlite_sequence WHERE name='z_parent'").get().seq,99);assert.equal(dst.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name IN ('child_parent_idx','child_view','child_trigger')").get().n,3);assert.equal(dst.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(files.length,0);}finally{dst.close();}}finally{db.close();}});
test('SQL and media TAR includes exact R2 bytes with original keys, no JSON manifest',{skip:!DatabaseSync},async()=>{const {env,files,db}=fixture();try{const res=await exportBackup(env,'database,media');assert.equal(files.length,0);const buf=await res.arrayBuffer();assert.equal(buf.byteLength,+res.headers.get('X-Export-Bytes'));const entries=readTar(buf);assert.ok(entries.has('backup.sql'));assert.equal(entries.has('backup.json'),false);assert.deepEqual(entries.get(key),data);assert.deepEqual(files,[key]);const dst=restore(new TextDecoder().decode(entries.get('backup.sql')));assert.equal(dst.prepare('SELECT name FROM media_files').get().name,'original video.mp4');dst.close();}finally{db.close();}});
test('invalid selections and unsafe archive paths rejected',async()=>{assert.deepEqual([...parseExportParts('database,media')],['database','media']);assert.throws(()=>parseExportParts('content'));assert.throws(()=>parseExportParts('media'));assert.throws(()=>tarHeader('../bad',1,0));assert.equal((await exportBackup({},'')).status,400);});
test('missing or changed R2 files abort TAR',{skip:!DatabaseSync},async()=>{for(const options of [{missing:true},{wrongSize:true}]){const {env,db}=fixture(options);try{const res=await exportBackup(env,'database,media');await assert.rejects(res.arrayBuffer(),/missing or changed/);}finally{db.close();}}});
test('dependency order traverses multi-level parents and terminates on cycles',()=>{const tables=['child','middle','parent'].map(name=>({name}));const fks=new Map([['child',[{table:'middle'}]],['middle',[{table:'PARENT'}]]]);assert.deepEqual(dependencyOrder(tables,fks).map(t=>t.name),['parent','middle','child']);fks.set('parent',[{table:'child'}]);assert.equal(dependencyOrder(tables,fks).length,3);assert.match(literalExpression('a"b'),/"a""b"/);});
test('route is protected, browser uses bearer authentication and bounded streaming fallback',()=>{const src=readFileSync(new URL('../src/index.js',import.meta.url),'utf8'),app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../public/backup-export.js',import.meta.url),'utf8');const auth=src.indexOf('if(!await authorized(req,env))'),route=src.indexOf("path==='/api/admin/export'");assert.ok(auth>=0&&route>auth);assert.match(app,/openBackupExport/);assert.match(ui,/Authorization:'Bearer '\+token/);assert.match(ui,/writer\.write\(value\)/);assert.match(ui,/total>FALLBACK_LIMIT/);assert.match(ui,/ext=isTar\?'tar':'sql'/);});
