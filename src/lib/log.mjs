const useColor = !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: (s) => paint('2', s),
  bold: (s) => paint('1', s),
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  cyan: (s) => paint('36', s),
};

export const SYM = { ok: '+', warn: '!', fail: 'x', info: '-' };

export const log = {
  plain: (msg = '') => console.log(msg),
  title: (msg) => console.log(`\n${c.bold(msg)}`),
  ok: (msg) => console.log(`  ${c.green(SYM.ok)} ${msg}`),
  warn: (msg) => console.log(`  ${c.yellow(SYM.warn)} ${msg}`),
  fail: (msg) => console.log(`  ${c.red(SYM.fail)} ${msg}`),
  info: (msg) => console.log(`  ${c.dim(SYM.info)} ${msg}`),
  step: (msg) => console.log(`${c.cyan('>')} ${msg}`),
};

/** Collects pass/fail findings so a command can exit with a meaningful code. */
export function createReport(title) {
  const findings = [];
  return {
    pass: (msg) => findings.push({ level: 'pass', msg }),
    warn: (msg) => findings.push({ level: 'warn', msg }),
    fail: (msg) => findings.push({ level: 'fail', msg }),
    get failures() {
      return findings.filter((f) => f.level === 'fail');
    },
    get warnings() {
      return findings.filter((f) => f.level === 'warn');
    },
    print({ verbose = false } = {}) {
      log.title(title);
      for (const f of findings) {
        if (f.level === 'fail') log.fail(f.msg);
        else if (f.level === 'warn') log.warn(f.msg);
        else if (verbose) log.ok(f.msg);
      }
      const passed = findings.length - this.failures.length - this.warnings.length;
      log.plain(
        `\n  ${c.green(`${passed} passed`)}  ${c.yellow(
          `${this.warnings.length} warnings`
        )}  ${c.red(`${this.failures.length} failures`)}`
      );
      return this.failures.length === 0;
    },
  };
}
