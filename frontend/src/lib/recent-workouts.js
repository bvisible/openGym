//// Neoffice — added file (no upstream equivalent).
////
//// The last sessions a member logged, newest day first — the order History lists them in (views/History.jsx historyRows): by day, and
//// within a day the one stored last first. Home shows the first three under « Recent workouts », each with its Share button.
export function lastWorkouts(S, n = 3) {
  return (S?.workouts || [])
    .filter(Boolean)
    .map((w, i) => [w, i])
    .sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1]))
    .slice(0, n)
    .map(([w]) => w)
}
