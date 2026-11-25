// Leaving the game and coming back (Patch 26): the pause menu's Return to Main Menu saves and brings back the title, whose
// Continue picks the game up where it was left and whose New Game starts afresh, twice over; Ctrl+W is the game's in play
// (held for the page in fullscreen by the Keyboard Lock), and leaving the page mid-game asks first, but not on the title.
// Saving stays on here (the other suites turn it off), each page a fresh browser profile.
const SETUP = `AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; return true;`;
// (a beforeunload as the browser sends it, with the page told it isn't driven by a test for the moment: does it ask?)
const ASKS = `Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); delete navigator.webdriver; return e.defaultPrevented;`;
const titleUp = (page) => page.waitForFunction(() => document.querySelector('#title .tmenu:not(.hidden)') && window.AG?.player.hero.model, null, { timeout: 180000 });

export default {
  name: 'Main menu and leaving',
  viewport: { w: 1280, h: 760, setup: false },
  async run(t) {
    await t.eval(SETUP);
    await t.step('Ctrl+W in play is the game\'s: the browser is never let close the tab from it', `const e = new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', ctrlKey: true, cancelable: true, bubbles: true }); dispatchEvent(e); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); return e.defaultPrevented || 'not prevented';`);
    // (fullscreen from the pause menu's button, a click: the page asks the browser for Esc and the keys it takes with Ctrl)
    await t.eval(`window._locked = null; if (navigator.keyboard) navigator.keyboard.lock = async (k) => { window._locked = k; }; g.pause(true); return true;`);
    await t.page.click('#sFs'); const fs = await t.until('window._locked || (document.fullscreenElement ? "no lock" : null)', 3000);
    if (await t.eval('return !!document.fullscreenElement;')) { await t.page.click('#sFs'); await t.until('!document.fullscreenElement', 3000); }
    t.check('in fullscreen the page holds Esc, Ctrl+W, Ctrl+T and Ctrl+N (Keyboard Lock)', Array.isArray(fs) && ['Escape', 'KeyW', 'KeyT', 'KeyN'].every((k) => fs.includes(k)), JSON.stringify(fs));
    await t.step('leaving the page mid-game asks first ("Leave site?")', ASKS);
    await t.step('the pause menu has Return to Main Menu', `const b = document.getElementById('pMain'), r = b?.getBoundingClientRect(); return (b && /Return to Main Menu/.test(b.textContent) && r.width > 0 && r.bottom <= innerHeight) || 'button ' + JSON.stringify(r);`);
    await t.shot('pause');
    // twice: leave for the title, Continue, and find everything where it was
    for (const [n, x, z, wood] of [[1, 30, 20, 7], [2, 44, 26, 11]]) {
      await t.eval(`g.pause(false); AG.teleport(${x}, ${z}); g.S.day = ${n + 2}; inv.slots.fill(null); g.give('wood', ${wood}); await until(() => P.onGround, 5000); g.pause(true); return true;`);
      await Promise.all([t.page.waitForNavigation({ timeout: 120000 }), t.page.click('#pMain')]); await titleUp(t.page);
      await t.step(`${n}: Return to Main Menu brings back the title, Continue on it with the day saved`, `const c = document.getElementById('tCont'); return (!AG.game.started && !/play/.test(location.search) && c && c.textContent.includes('Day ${n + 2}')) || JSON.stringify({ started: AG.game.started, url: location.href, cont: c?.textContent });`);
      await t.step(`${n}: …where leaving the page asks nothing`, `return !(${`(() => { ${ASKS} })()`}) || 'asked on the title';`);
      if (n === 1) await t.shot('title');
      await t.page.click('#tCont'); await t.until('AG.game.started && document.getElementById("title") === null', 10000);
      await t.step(`${n}: Continue picks the game up where it was left`, `${SETUP.replace('return true;', '')} await frames(5); const d = Math.hypot(P.pos.x - ${x}, P.pos.z - ${z}); return (d < 1 && inv.count('wood') === ${wood} && g.S.day === ${n + 2}) || JSON.stringify({ d, wood: inv.count('wood'), day: g.S.day });`);
      await t.step(`${n}: …and leaving mid-game asks again`, ASKS);
    }
    // and New Game from the title it came back to: the saved world given up (yes to the question), a new trial begun
    await t.eval(`g.pause(true); return true;`);
    await Promise.all([t.page.waitForNavigation({ timeout: 120000 }), t.page.click('#pMain')]); await titleUp(t.page);
    t.page.once('dialog', (d) => d.accept());
    await Promise.all([t.page.waitForNavigation({ timeout: 120000 }), t.page.click('#tNew')]); await titleUp(t.page);
    await t.step('New Game from the title: a fresh trial offered, the old save gone', `return (!document.getElementById('tCont') && /Begin the Trial/.test(document.getElementById('tNew').textContent) && !localStorage.getItem('argonisos.world.v1')) || document.querySelector('#title nav').textContent;`);
    await t.page.click('#tNew'); await t.until('AG.game.creator.open', 5000); await t.page.click('#cDone');
    await t.step('…the creator, then the trial begins on the shore with an empty pack', `await until(() => AG.game.started, 5000); ${SETUP.replace('return true;', '')} const d = Math.hypot(P.pos.x - g.spawnAt.x, P.pos.z - g.spawnAt.z); return (g.started && d < 2 && !inv.count('wood')) || JSON.stringify({ started: g.started, d, wood: inv.count('wood') });`);
  },
};
