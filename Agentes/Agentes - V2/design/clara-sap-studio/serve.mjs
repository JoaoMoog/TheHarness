import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const html=new URL('./index.html',import.meta.url);
const port=Number(process.env.PORT||4178);
createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return}if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(html));}).listen(port,'127.0.0.1',()=>console.log(`CLARA: http://127.0.0.1:${port}`));
