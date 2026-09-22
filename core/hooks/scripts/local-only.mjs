import { collectStrings, verdict, readHookInput, isHookMode, isMain, emitVerdict } from './lib/io.mjs';
export const failsSecure = true;
// Agent guardrail only. A person's own terminal and manual Git hooks are unaffected.
export function decide(input) {
  const tool=String(input.tool_name ?? '');
  const ti=input.tool_input ?? {};
  const command=collectStrings({command:ti.command,cmd:ti.cmd,script:ti.script,commands:ti.commands}).join('\n');
  const git=/\bgit(?:\.exe)?\s+(?:(?:-C|-c|--git-dir|--work-tree)(?:=\S+|\s+(?:"[^"]*"|'[^']*'|\S+))\s+)*(?:add|commit|push)\b/i;
  const publish=/\bgh\s+(?:pr\s+(?:create|merge|comment|review)|workflow\s+run|release\s+create)\b|\baz\s+(?:repos\s+pr\s+create|pipelines\s+run)\b|\b(?:vercel|netlify)\s+(?:deploy|--prod)\b|\bnpm\s+publish\b/i;
  if (git.test(command) || publish.test(command) || /(?:push_files|create_commit|create_release|deploy_project)/i.test(tool) || /(?:create|merge|comment).*(?:pull.?request)|(?:run|trigger).*(?:pipeline|workflow)|(?:git[\/_-])(?:add|commit|push)\b/i.test(tool))
    return verdict.deny('TheHarness stops at local validation. Staging, commit, push, PR and deployment are manual.');
  return null;
}
if (isMain(import.meta.url)) {
  const input=await readHookInput();
  if (isHookMode(input)) process.exit(emitVerdict('PreToolUse',decide(input)));
}
