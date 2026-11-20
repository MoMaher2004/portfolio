#!/usr/bin/env python3
"""Generate idempotent D1 seed SQL using defaults.json. Does not overwrite existing rows."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=json.loads((root/'data/defaults.json').read_text())
arrays=['projects','experience','socials','views','hardSkills','softSkills','certificates','offers','customSections','media']
configs=['hero','settings','brand','sections','sectionsOrder']
q=lambda v: "'"+v.replace("'","''")+"'"
lines=['-- Auto-generated from data/defaults.json, idempotent; do not edit manually.']
for key in configs:
 lines.append('INSERT OR IGNORE INTO configuration(name,content) VALUES('+q(key)+','+q(json.dumps(s[key],ensure_ascii=False,separators=(',',':')))+');')
for key in arrays:
 for i,item in enumerate(s[key]):
  lines.append('INSERT OR IGNORE INTO content_items(collection,id,position,content) VALUES('+q(key)+','+q(item['id'])+','+str(i)+','+q(json.dumps(item,ensure_ascii=False,separators=(',',':')))+');')
(root/'database/0002_seed.sql').write_text('\n'.join(lines)+'\n')
print('Seed migration updated.')
