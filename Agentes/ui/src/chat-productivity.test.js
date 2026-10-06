import test from "node:test";
import assert from "node:assert/strict";
import { editorSnapshot, diagnosticsText } from "./chat-productivity.js";
test("editor snapshot keeps UTF16 positions and dirty provenance without writing", () => {
  const range = {
    startLineNumber: 2,
    startColumn: 3,
    endLineNumber: 2,
    endColumn: 7,
  };
  const file = {
    root: "C:/repo",
    path: "a.ts",
    dirty: true,
    model: {
      getValueInRange(r) {
        assert.equal(r, range);
        return "😀ab";
      },
      getFullModelRange() {
        return range;
      },
    },
  };
  assert.deepEqual(editorSnapshot(file, range), {
    root: "C:/repo",
    path: "a.ts",
    dirty: true,
    text: "😀ab",
    startLine: 2,
    startColumn: 3,
    endLine: 2,
    endColumn: 7,
  });
  assert.equal(editorSnapshot(file).text, "😀ab");
  assert.throws(() => editorSnapshot(null), /Abra/);
  assert.throws(
    () =>
      editorSnapshot({
        ...file,
        model: {
          getValueInRange: () => "a".repeat(65537),
          getFullModelRange: () => range,
        },
      }),
    /64 KiB/,
  );
});
test("diagnostics does not fabricate categories or claim cache saved credits", () => {
  assert.match(diagnosticsText({ session: false }), /não chama o modelo/);
  assert.match(
    diagnosticsText({
      session: false,
      runtime: { version: "1.0.91", protocolVersion: 3 },
    }),
    /Copilot CLI 1.0.91 · protocolo 3/,
  );
  const text = diagnosticsText({
    session: true,
    policy: "unavailable-native-fallback",
    usage: { cacheReadTokens: 1000, cacheWriteTokens: 20, outputTokens: 4 },
  });
  assert.match(text, /fallback nativo/);
  assert.match(text, /Entrada sem cache: indisponível/);
  assert.match(text, /não é economia/);
});
