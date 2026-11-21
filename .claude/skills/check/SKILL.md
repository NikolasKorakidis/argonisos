---
name: check
description: Run Argonisos's checks before a commit or pull request (lint, import cycles, unused files, the world fingerprint, then the quick game suites on the GPU) and summarise what failed and why.
---

Run these from the project root, in order, and stop to report at the first stage that fails:

1. `npm run check`: the repository guard, lint, the stylesheet, the tests' in-page imports, import cycles, unused files
   and dependencies, and the world fingerprint (Node only, under a minute on an idle machine).
2. `npm run test:quick`: the game's suites in headless Chrome on the GPU, without the slow ones (perf, visual, creatures,
   combat, light, structures); many minutes, more on a busy machine (`tests/reports/results.json` has each suite's time).
   Run it in the background and wait for it to finish.
3. If the change could alter how the game looks or performs, also `node tests/run.mjs perf visual`. Check the machine
   load first (`uptime`): timings from a busy machine are meaningless, so rerun them rather than trusting them.

Then summarise: what passed, each failure with its reason, and whether it is caused by the change or flaky (rerun a
failing suite once on its own before calling it flaky). Never run `npm run test:update` or `--update` to make a test
pass; a changed picture or fingerprint means the game changed.
