/**
 * Behavioural evals without an API key.
 *
 * Everything here runs through GitHub Copilot on the machine, so there is no
 * key to call and nothing to bill. The split is:
 *
 *   --emit   prints the golden cases as a prompt to paste into a Copilot agent
 *   --check  reads that agent answers back and runs the assertions in Node
 *
 * The assertions stay deterministic. Only the part that needs a model leaves
 * the process, and it leaves through a human who can see what it cost.
 */
import fs from 'node:fs';
import path from 'node:path';

const ASSERTIONS = {
  contains: (text, value) => text.toLowerCase().includes(String(value).toLowerCase()),
  notContains: (text, value) => !text.toLowerCase().includes(String(value).toLowerCase()),
  matches: (text, value) => safeRegex(value)?.test(text) ?? false,
  minLength: (text, value) => text.length >= Number(value),
};

/** A bad pattern in one case must fail that case, not the whole run. */
function safeRegex(value) {
  try {
    return new RegExp(value, 'i');
  } catch {
    return null;
  }
}

export function loadCases(goldenRoot) {
  if (!fs.existsSync(goldenRoot)) return [];
  return fs
    .readdirSync(goldenRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((dir) => {
      const dirPath = path.join(goldenRoot, dir.name);
      return fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const file = path.join(dirPath, f);
          try {
            return { subject: dir.name, id: `${dir.name}/${f.replace('.json', '')}`, file, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
          } catch (err) {
            return { subject: dir.name, id: `${dir.name}/${f}`, file, broken: err.message };
          }
        });
    });
}

/** The prompt a Copilot agent runs. One case per block, answers keyed by id. */
export function emitPrompt(cases, skillsRoot) {
  const lines = [
    'Run each case below against the skill named in it, exactly as you would if a',
    'user had asked. Do not read the assertions; there are none here on purpose.',
    '',
    'Answer in this shape, one block per case, and nothing else:',
    '',
    '=== <case id> ===',
    '<your answer>',
    '',
  ];

  for (const testCase of cases) {
    if (testCase.broken) continue;
    const skillFile = path.join(skillsRoot, testCase.subject, "SKILL.md");
    const agentFile = path.join(skillsRoot, "..", "agents", `${testCase.subject}.agent.md`);
    const source = fs.existsSync(skillFile) ? skillFile : fs.existsSync(agentFile) ? agentFile : null;
    lines.push('---');
    lines.push(`case: ${testCase.id}`);
    lines.push(`follow: ${source ?? `(nothing defines ${testCase.subject})`}`);
    lines.push(`prompt: ${testCase.prompt}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Splits an answer file back into per-case text. */
export function parseAnswers(text) {
  const answers = new Map();
  const blocks = String(text).split(/^===\s*(.+?)\s*===$/m);
  for (let i = 1; i < blocks.length; i += 2) {
    answers.set(blocks[i].trim(), (blocks[i + 1] ?? '').trim());
  }
  return answers;
}

export function checkCase(testCase, answer) {
  if (testCase.broken) return { ...testCase, ok: false, error: `case file is not valid JSON: ${testCase.broken}` };
  if (answer === undefined) return { ...testCase, ok: false, error: 'no answer for this case' };

  const results = (testCase.assertions ?? []).map((assertion) => {
    const check = ASSERTIONS[assertion.type];
    return { ...assertion, ok: check ? check(answer, assertion.value) : false, unknownType: !check };
  });
  return { ...testCase, ok: results.length > 0 && results.every((r) => r.ok), results };
}

export function checkAll(cases, answersText) {
  const answers = parseAnswers(answersText);
  return cases.map((testCase) => checkCase(testCase, answers.get(testCase.id)));
}
