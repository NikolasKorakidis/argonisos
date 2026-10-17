// Claude Code hook (see .claude/settings.json): after Claude edits or writes a file, lint that one file and hand any
// problems straight back to Claude (exit code 2 sends what's printed here to it), so a mistake is fixed at once rather
// than found by the tests minutes later. Silent when the file is fine or isn't one of ours.
import path from 'node:path';
import { ESLint } from 'eslint';

let input = ''; for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input || '{}').tool_input?.file_path;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (!file || !/\.(m?js)$/.test(file) || !file.startsWith(root)) process.exit(0);
const eslint = new ESLint({ cwd: root });
if (await eslint.isPathIgnored(file)) process.exit(0);
const results = await eslint.lintFiles([file]), problems = results.reduce((n, r) => n + r.errorCount + r.warningCount, 0);
if (!problems) process.exit(0);
process.stderr.write((await eslint.loadFormatter('stylish')).format(results));
process.exit(2);
