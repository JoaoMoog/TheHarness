import http from 'node:http';
import fs from 'node:fs';
const allowed=new Set(['ciclo-passo-a-passo.html','ciclos-de-desenvolvimento.html','custo-do-copilot.html','docs/guides.css','docs/guides.js']);
http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  if (!allowed.has(name)) { res.writeHead(404);res.end('Not found');return; }
  res.setHeader('Content-Type',name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  res.end(fs.readFileSync(name));
}).listen(4177,'127.0.0.1');
