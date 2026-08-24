//// Neoffice — web push is switched OFF until the server side exists.
////
//// Upstream stored subscriptions in its own Node server and pushed with VAPID
//// keys generated on first run. That server is gone. Frappe self-hosted has no
//// replacement out of the box either: frappe/push_notification talks to the
//// Frappe Cloud notification relay, which our instances do not have — Raven
//// fetches its vapid_public_key from exactly that relay. So the real fix is
//// pywebpush + our own VAPID keys per instance + a Gym Push Subscription
//// doctype, which is the push lot, not this one.
////
//// Reporting "unsupported" rather than throwing is deliberate: Settings hides
//// the whole notifications section on that answer, so the member is never shown
//// a switch that silently does nothing. The one thing push was load-bearing for
//// — the rest timer firing with the app closed — is covered meanwhile by the
//// wake lock, which keeps the screen on for the length of a workout.

export const pushSupported = () => false
export const pushPermission = () => 'unsupported'

export async function enablePush() {
	throw new Error('Push notifications are not available on this instance yet')
}

export async function disablePush() {
	// Nothing subscribed, nothing to tear down.
}

export const sendTestPush = () => Promise.reject(new Error('Push notifications are not available on this instance yet'))
