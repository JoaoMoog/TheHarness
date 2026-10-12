import assert from "node:assert/strict";
import { it } from "node:test";
// @ts-expect-error Browser module is intentionally plain JavaScript.
import { registerLocalAccount, unlockLocalAccount, lockLocalAccount, locallyUnlocked } from "../../public/js/local-auth.js";

it("stores salted credentials without plaintext; rejects wrong PIN and limits repeated attempts", async () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  } });
  await assert.rejects(registerLocalAccount("123"), /6 números/);
  await registerLocalAccount("483927");
  const first = [...data.values()][0]!;
  assert.ok(!first.includes("483927"));
  assert.equal(JSON.parse(first).salt.length, 32);
  assert.equal(JSON.parse(first).hash.length, 64);
  lockLocalAccount();
  await assert.rejects(unlockLocalAccount("000000"), /incorreto/);
  assert.equal(locallyUnlocked(), false);
  await unlockLocalAccount("483927");
  assert.equal(locallyUnlocked(), true);
  lockLocalAccount();
  for (let i = 0; i < 5; i++) await assert.rejects(unlockLocalAccount("000000"), /incorreto/);
  await assert.rejects(unlockLocalAccount("483927"), /30 segundos/);
  assert.equal(locallyUnlocked(), false);
  data.clear();
  await registerLocalAccount("483927");
  assert.notEqual(JSON.parse([...data.values()][0]!).hash, JSON.parse(first).hash);
});
