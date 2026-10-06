import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBuffer } from "./editor-format.js";
test("TSX/TypeScript formatter preserves semantics and is idempotent", async () => {
  for (const [path, source] of [
    ["a.ts", "function a(x:number){return {value:x,text:'  untouched  '}}"],
    [
      "a.tsx",
      "export const A=()=>{return <div className='x'><span>Hello</span></div>}",
    ],
    ["a.json", '{"a":{"b":1}}'],
  ]) {
    const text = await formatBuffer(path, source);
    assert.ok(text.includes("\n"));
    assert.equal(await formatBuffer(path, text), text);
    if (path === "a.ts") assert.ok(text.includes("  untouched  "));
  }
});
test("invalid source is rejected instead of destructive guessed indentation", async () => {
  await assert.rejects(() => formatBuffer("a.ts", "function x( {"));
  await assert.rejects(() => formatBuffer("a.xyz", "x"));
});
