// Isolated test fixture only, not a production MCP or an agent implementation.
// MCP stdio: one UTF-8 JSON-RPC message per line. No network, no credentials.
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
const [audit, label = "primary", mode] = process.argv.slice(2);
function response(req) {
  if (req.id === undefined) return;
  let result;
  if (req.method === "initialize") result = {
    protocolVersion: req.params?.protocolVersion || "2025-03-26",
    capabilities: { tools: {} }, serverInfo: { name: "speedcode-fixture", version: "1.0.0" },
  };
  else if (req.method === "tools/list") result = { tools: [{
    name: "fixture_echo", description: "Return the fixture verification phrase. Only used by SpeedCode integration tests.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }] };
  else if (req.method === "tools/call" && req.params?.name === "fixture_echo") {
    appendFileSync(audit, `${label}:called\n`);
    result = { content: [{ type: "text", text: label.startsWith("oversized") ? "x".repeat(2*1024*1024) : `MCP_VERIFIED_${label.toUpperCase()}` }] };
  } else if (req.method === "ping") result = {};
  else {
    return {jsonrpc:"2.0", id:req.id, error:{code:-32601,message:"Fixture method not supported"}};
  }
  return { jsonrpc: "2.0", id: req.id, result };
}
if (mode === "--http") {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {res.writeHead(405).end();return;}
    let bytes=0, body="";
    for await (const chunk of req) {bytes+=chunk.length;if(bytes>65536){res.writeHead(413).end();return;}body+=chunk;}
    try {
      const result=response(JSON.parse(body));
      if (!result) {res.writeHead(202).end();return;}
      res.writeHead(200,{"Content-Type":label === "oversized-sse" ? "text/event-stream" : "application/json"});
      if(label === "oversized-sse") res.end(`data: ${JSON.stringify(result)}\n\n`);
      else { res.write(JSON.stringify(result)); res.end(); } // deliberately chunked: no Content-Length
    }catch {res.writeHead(400).end();}
  });
  server.listen(0,"127.0.0.1",()=>process.stdout.write(`http://127.0.0.1:${server.address().port}/mcp\n`));
} else {
  const input=createInterface({input:process.stdin,crlfDelay:Infinity});
  input.on("line",line=>{
    try {const result=response(JSON.parse(line));if(result)process.stdout.write(JSON.stringify(result)+"\n");}catch{/* invalid fixture request */}
  });
}
