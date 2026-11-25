// Export actual SQLite schema and values, not the CMS's filtered JSON view.
const schemaSQL="SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type,name";
const identifier=name=>'"'+String(name).replaceAll('"','""')+'"';
const internal=name=>/^(sqlite_|_cf_)/i.test(name);
const rows=result=>result.results||[];
const statement=sql=>sql.trim().replace(/;\s*$/,'')+';';
const MAX_SQL_BYTES=32*1024*1024;
const encoder=new TextEncoder();
export function dependencyOrder(tables,foreignKeys){
 const names=new Map(tables.map(t=>[t.name.toLowerCase(),t]));
 const visited=new Set(),visiting=new Set(),ordered=[];
 function visit(table){
  const key=table.name.toLowerCase();if(visited.has(key)||visiting.has(key))return;
  visiting.add(key);
  for(const fk of foreignKeys.get(table.name)||[]){const parent=names.get(String(fk.table).toLowerCase());if(parent)visit(parent);}
  visiting.delete(key);visited.add(key);ordered.push(table);
 }
 for(const table of tables)visit(table);
 return ordered;
}
// Generate literals inside SQLite, before D1 converts int64 to JS Number.
// quote() truncates embedded NUL in text; use a hex cast for that case.
export function literalExpression(column){
 const c=identifier(column);
 return `CASE WHEN typeof(${c})='text' AND instr(${c},char(0))>0 THEN 'CAST(X'''||hex(${c})||''' AS TEXT)' WHEN typeof(${c})='real' AND ${c}>1.7976931348623157e308 THEN '9e999' WHEN typeof(${c})='real' AND ${c}<-1.7976931348623157e308 THEN '-9e999' ELSE quote(${c}) END`;
}
export async function buildSqlBackup(db,{mediaIncluded=false}={}){
 const schema=rows(await db.prepare(schemaSQL).all());
 const objects=schema.filter(o=>!internal(o.name)&&!internal(o.tbl_name));
 const tables=objects.filter(o=>o.type==='table');
 if(tables.some(t=>/^CREATE\s+VIRTUAL\s+TABLE\b/i.test(t.sql)))throw Error('Virtual tables require a dedicated SQLite export.');
 const metadata=tables.length?await db.batch(tables.flatMap(t=>[db.prepare(`PRAGMA table_xinfo(${identifier(t.name)})`),db.prepare(`PRAGMA foreign_key_list(${identifier(t.name)})`)])):[];
 const foreignKeys=new Map(),columns=new Map();
 for(const [i,t] of tables.entries()){
  const names=rows(metadata[2*i]).filter(c=>Number(c.hidden||0)===0).map(c=>c.name);
  if(!names.length)throw Error('Cannot export columns for table '+t.name);
  columns.set(t.name,names);foreignKeys.set(t.name,rows(metadata[2*i+1]));
 }
 const ordered=dependencyOrder(tables,foreignKeys);
 const sequence=schema.some(o=>o.type==='table'&&o.name==='sqlite_sequence');
 const selectRows=t=>`SELECT ${columns.get(t.name).map((c,i)=>`${literalExpression(c)} AS ${identifier('v'+i)}`).join(',')} FROM ${identifier(t.name)}`;
 const queries=[db.prepare(schemaSQL),...ordered.map(t=>db.prepare(selectRows(t)))];
 if(sequence)queries.push(db.prepare('SELECT quote(name) AS name_sql, quote(seq) AS seq_sql FROM sqlite_sequence'));
 if(mediaIncluded&&tables.some(t=>t.name==='media_files'))queries.push(db.prepare('SELECT * FROM media_files ORDER BY id'));
 // A single D1 batch reads data transactionally. Reject concurrent schema changes.
 const results=await db.batch(queries);
 if(JSON.stringify(rows(results[0]))!==JSON.stringify(schema))throw Error('Database schema changed during export. Retry.');
 const pieces=[];let size=0;
 function append(line){const bytes=encoder.encode(line+'\n');size+=bytes.byteLength;if(size>MAX_SQL_BYTES)throw Error('SQL export exceeds 32 MiB. Use wrangler d1 export for a larger database.');pieces.push(bytes);}
 append('-- Portfolio D1 / SQLite backup. Restore into an EMPTY database.');
 append('-- Contains private data. Do not commit or share this file.');
 append(mediaIncluded?'-- R2 files are included separately in the archive at their original object keys.':'-- R2 binaries are NOT included; media metadata and references are preserved.');
 append('-- D1 imports manage transactions; no explicit BEGIN/COMMIT is emitted.');
 append('PRAGMA defer_foreign_keys=ON;');
 for(const t of ordered)append(statement(t.sql));
 // Explicit unique indexes can be required by parent foreign keys. Build them
 // before inserting rows; install views and triggers after restoring data.
 for(const o of objects.filter(o=>o.type==='index'))append(statement(o.sql));
 for(const [i,t] of ordered.entries()){
  const names=columns.get(t.name),prefix=`INSERT INTO ${identifier(t.name)} (${names.map(identifier).join(',')}) VALUES (`;
  for(const r of rows(results[i+1])){
   const values=names.map((_,j)=>r['v'+j]);if(values.some(v=>typeof v!=='string'))throw Error('Missing SQL literal for table '+t.name);
   append(prefix+values.join(',')+');');
  }
 }
 if(sequence){append('DELETE FROM sqlite_sequence;');for(const r of rows(results[1+ordered.length]))append(`INSERT INTO sqlite_sequence(name,seq) VALUES (${r.name_sql},${r.seq_sql});`);}
 for(const type of ['view','trigger'])for(const o of objects.filter(o=>o.type===type))append(statement(o.sql));
 // Leave checks deferred until the importer commits; do not disable them mid-transaction.
 const sql=new Uint8Array(size);let at=0;for(const piece of pieces){sql.set(piece,at);at+=piece.length;}
 const media=mediaIncluded&&tables.some(t=>t.name==='media_files')?rows(results.at(-1)):[];
 return {sql,media};
}
