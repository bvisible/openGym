/* Shared scaffolding for the api tests.
 *
 * Every module under coach/ resolves DATA_DIR at import time (the same way server.js does),
 * so a test that wants its own data directory has to set the variable before the first
 * import. Hence dynamic imports everywhere below, and one helper that does it in the right
 * order. node:test runs each file in its own process, so one directory per file is enough.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* The port a spawned server.js actually bound.
 *
 * Never pick one for it. Opening a listener on 0, reading the port, closing it and handing the
 * number to a child that binds it a process start later leaves a window the kernel re-issues
 * ephemeral ports inside -- 8 repeats in 400 open/close rounds on this box -- and a dozen test
 * files spawn servers at once, so two draw the same number, one child loses the bind and dies,
 * and the other file's server answers on it: a different data dir, a db.json without the test's
 * user, and a 401 where the answer belongs. It cost one unreproducible failure before anyone
 * looked.
 *
 * So the child picks its own port (PORT=0) and says which on its boot line. That line cannot be
 * printed before the socket is bound, which makes it the readiness signal as well -- no polling
 * /api/health, and no waiting on a server that died at boot either.
 *
 * `tail` supplies whatever the caller has collected of the child's output, for the message.
 */
export function boundPort(child, tail = () => '') {
  return new Promise((resolve, reject) => {
    let seen = '';
    const give = setTimeout(() => reject(new Error(`server never announced a port:\n${tail() || seen}`)), 20000);
    const look = d => {
      seen += d;
      const m = /gym-api on :(\d+)/.exec(seen);
      if (!m) return;
      clearTimeout(give);
      child.stdout.off('data', look);
      resolve(+m[1]);
    };
    child.stdout.on('data', look);
    child.once('exit', code => { clearTimeout(give); reject(new Error(`server exited (${code}):\n${tail() || seen}`)); });
  });
}

export function tempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-test-'));
  fs.writeFileSync(path.join(dir, 'secret'), 'a'.repeat(64), { mode: 0o600 });
  process.env.DATA_DIR = dir;
  return dir;
}

export function writeState(dir, uid, S) {
  fs.writeFileSync(path.join(dir, 'state-' + uid + '.json'), JSON.stringify(S));
}

//// Neoffice — the sample's dates follow the clock. They were fixed at 2026-07-20 and the review keeps the last twelve weeks (MAX_WEEKS in
//// coach/core/payload.js): from 2026-10-13, the day that workout fell out of the window, every test that builds a review from this state
//// failed (jobs, coach-limits, payload, routes). The day is a Monday between ten and sixteen days ago: always inside the window, and on
//// the weekday the tests were written for.
const iso = d => d.toISOString().slice(0, 10);
const DAY = 86400000;
function sampleDay() {
  const d = new Date(Date.now() - 10 * DAY);
  while (d.getUTCDay() !== 1) d.setTime(d.getTime() - DAY);
  return d;
}
export const SAMPLE_DAY = iso(sampleDay());
export const SAMPLE_EARLIER_DAY = iso(new Date(sampleDay().getTime() - 19 * DAY));

/** A profile that has consented and has some history — the usual starting point. */
export function sampleState(over = {}) {
  return {
    unit: 'kg', lang: 'en', effort: 'rpe', targetW: 80,
    coach: { consent: { agreedAt: new Date().toISOString(), version: 1 }, profile: { goal: 'muscle', daysPerWeek: 3, equipment: ['dumbbell'] } },
    routines: [{
      id: 'r1', name: 'Full body A', emoji: '💪', prog: 'linear',
      ex: [
        { id: '0001', sets: 3, reps: 10, mode: 'reps', weight: 20, prog: 'linear' },
        { id: '0007', sets: 3, sec: 45, mode: 'time' }
      ]
    }],
    week: { 1: 'r1', 3: 'r1', 5: 'r1' },
    dayPlan: {},
    exWeights: { '0001': { w: 20 } },
    bodyweight: [{ d: SAMPLE_EARLIER_DAY, w: 78 }, { d: SAMPLE_DAY, w: 78.5 }],
    customEx: [],
    workouts: [{
      id: 'w1', d: SAMPLE_DAY, name: 'Full body A', start: 1000, end: 1000 + 45 * 60000, vol: 600, prs: [],
      entries: [{
        id: '0001', target: { sets: 3, reps: 10, weight: 20 },
        sets: [{ w: 20, r: 10, done: true, rpe: 9.5 }, { w: 20, r: 9, done: true, rpe: 10 }, { w: 20, r: 8, done: true, rpe: 10 }]
      }]
    }],
    ...over
  };
}
