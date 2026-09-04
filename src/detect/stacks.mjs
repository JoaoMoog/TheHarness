import fs from 'node:fs';
import path from 'node:path';

const MAX_DEPTH = 2;
const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'bin', 'obj', 'vendor',
  '.venv', 'venv', '__pycache__', 'target', '.next', '.nuxt', 'coverage',
]);

/** Each stack maps to the instruction and skill files scoped to it. */
const STACKS = [
  { id: 'node-ts', files: ['tsconfig.json'], globs: [/\.tsx?$/] },
  { id: 'node', files: ['package.json'], globs: [] },
  { id: 'react', globs: [/\.[jt]sx$/], dep: 'react' },
  { id: 'vue', globs: [/\.vue$/], dep: 'vue' },
  { id: 'dotnet', globs: [/\.(csproj|fsproj|sln)$/] },
  { id: 'python', files: ['pyproject.toml', 'requirements.txt', 'setup.py'], globs: [/\.py$/] },
  { id: 'go', files: ['go.mod'], globs: [/\.go$/] },
  { id: 'java', files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], globs: [/\.java$/] },
  { id: 'rust', files: ['Cargo.toml'], globs: [/\.rs$/] },
  { id: 'cpp', files: ['CMakeLists.txt'], globs: [/\.(cpp|cc|hpp|cxx)$/] },
  { id: 'terraform', globs: [/\.tf$/] },
  { id: 'docker', files: ['Dockerfile', 'docker-compose.yml', 'compose.yaml'] },
];

/** Shallow walk: deep trees cost time and add nothing to stack identification. */
function collectEntries(dir, depth = 0, acc = { files: [], names: new Set() }) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) collectEntries(path.join(dir, entry.name), depth + 1, acc);
    } else if (entry.isFile()) {
      acc.files.push(entry.name);
      if (depth === 0) acc.names.add(entry.name);
    }
  }
  return acc;
}

function packageDeps(repoDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export function detectStacks(repoDir) {
  const { files, names } = collectEntries(repoDir);
  const deps = names.has('package.json') ? packageDeps(repoDir) : {};
  const found = [];
  for (const stack of STACKS) {
    const byFile = (stack.files ?? []).some((f) => names.has(f));
    const byGlob = (stack.globs ?? []).some((re) => files.some((f) => re.test(f)));
    const byDep = stack.dep ? Object.hasOwn(deps, stack.dep) : false;
    if (byFile || byGlob || byDep) found.push(stack.id);
  }
  // node-ts already implies node; keeping both adds noise with no signal.
  return found.includes('node-ts') ? found.filter((s) => s !== 'node') : found;
}

export const KNOWN_STACKS = STACKS.map((s) => s.id);

/**
 * Finds repositories under a root. Search depth matters: teams group
 * repositories by client or squad, and a depth-1 walk over such a tree finds
 * nothing and reports zero without explaining why.
 */
export function findRepos(rootDir, depth = 2) {
  const found = [];
  const walk = (dir, level) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (fs.existsSync(path.join(full, ".git"))) {
        found.push(full);
        continue; // a repository is a leaf; nested repos are submodules
      }
      if (level < depth) walk(full, level + 1);
    }
  };
  walk(rootDir, 1);
  return found;
}
