#//// Neoffice — added file (no upstream equivalent).
#////
#//// Minimal Frappe app identity, and nothing more. This repository holds the
#//// training journal (React, AGPL-3.0) and every change we make to it; the
#//// model, the API, the permissions and the ERP links live in the private
#//// neoffice_gym app, which talks to this one over HTTP/JSON and never imports
#//// from it. Keeping that boundary real is what lets neoffice_gym stay private
#//// while the AGPL obligation is satisfied here — so resist adding server code
#//// to this file: it belongs on the other side.

app_name = "opengym"
app_title = "openGym"
app_publisher = "Duarte Santos / Neoservice fork"
app_description = "Self-hosted gym & body-weight tracker — the training journal served at /gym"
app_email = "dev@neoservice.ch"
app_license = "AGPL-3.0-or-later"

#//// Neoffice — no routes declared here on purpose: /gym is owned by
#//// neoffice_gym, which renders the shell with the session and the boot data.
#//// Two apps claiming the same route would be a resolution order nobody can
#//// read six months later.
