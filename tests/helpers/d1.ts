import { execFileSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Env } from '../../src/shared/types';
export function database(){
 const folder=mkdtempSync(join(tmpdir(),'oph-real-data-test-')),file=join(folder,'db.sqlite');
 execFileSync('python3',['-c',`import sqlite3,pathlib,sys\nc=sqlite3.connect(sys.argv[1])\nfor p in sorted(pathlib.Path('migrations').glob('*.sql')):c.executescript(p.read_text())\nc.close()`,file]);
 const python=`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON')
x=json.load(sys.stdin)
try:
 c.execute('BEGIN');out=[]
 for s in x:
  q=c.execute(s['sql'],s['values']);out.append({'results':[dict(r) for r in q.fetchall()] if q.description else [],'meta':{'changes':q.rowcount}})
 c.commit();print(json.dumps(out))
except Exception as e:
 c.rollback();print(str(e),file=sys.stderr);sys.exit(1)
`;
 const run=(s:{sql:string;values:unknown[]}[])=>JSON.parse(execFileSync('python3',['-c',python,file],{input:JSON.stringify(s),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 class Statement{constructor(readonly sql:string,readonly values:unknown[]=[]){ }bind(...v:unknown[]){return new Statement(this.sql,v);}async all(){return run([this])[0];}async first(){return run([this])[0].results[0]||null;}async run(){return run([this])[0];}}
 return {env:{ADMIN_KEY:'test-only-bootstrap-key-for-operations',SITE_URL:'https://test.example.com',DB:{prepare:(s:string)=>new Statement(s),batch:async(s:any[])=>run(s)}} as unknown as Env,sql:(s:string,v:unknown[]=[])=>run([{sql:s,values:v}])[0].results,close:()=>rmSync(folder,{recursive:true,force:true})};
}
