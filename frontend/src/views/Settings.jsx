import { useEffect, useRef, useState, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF, hasData } from '../store/useStore.js'
//// Neoffice — level helpers from lib/level.js, not the store: upstream's view tests mock the store.
import { levelOf, isSimple } from '../lib/level.js'
import { workoutControls } from '../lib/workout-controls.js'
import { convertStateUnit } from '../lib/units.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, todayISO, localTZ, weekStartOf, MONDAY, SUNDAY } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
//// Neoffice — passkeys are gone: the Frappe session is the sign-in, and the
//// journal never had a user directory of its own here. IS_ANDROID stays (it
//// only phrases a hint about the install prompt).
import { IS_ANDROID, myCoach, openChat, wallet, classesMine } from '../lib/api.js'
import { pushSupported, enablePush, disablePush, sendTestPush } from '../lib/push.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t, LANGS, INSTR_LANGS, dateLocale } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { MOBILE, isAndroid, shareExport, syncReminder } from '../lib/mobile.js'
import { checkForUpdate, downloadAndInstall } from '../lib/update.js'
import { ConnectSheet } from './MobileOnboarding.jsx'
import { starterPlanSheet, confirmSheet, importFromApp, importFromHevy, equipmentProfileSheet, menuSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button, TextField } from '../components/ui.jsx'
import { showsEffortSetting, showsEquipmentProfiles, showsRestPauseSetting } from '../lib/level-visibility.js'

export default function Settings() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const coachLocal = useStore(s => s.coachLocal)
  const { update, replaceState, setUser, pullState, pushState, signOut, signOutAll, resetDemo, disconnectServer } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()

  // Two honest choices on a unit switch (issue #22): convert the numbers, or keep them and only
  // change the label — the old behaviour, still right for someone who logged in lb all along
  // under a kg label. Closing the sheet leaves the unit as it was.
  const switchUnit = v => {
    if (v === S.unit) return
    menuSheet({
      title: t('Convert to {0}?', v),
      subtitle: t('Every stored weight — logged sets, working weights, routine targets, body weight, bar weights — is in {0}. Convert the numbers, or keep them and only change the label?', S.unit),
      items: [
        { icon: 'shuffle', label: t('Convert the numbers'), onClick: () => replaceState(convertStateUnit(useStore.getState().S, v)) },
        { icon: 'pencil', label: t('Keep the numbers, change the label'), onClick: () => update(s => { s.unit = v }) },
      ],
    })
  }

  // --- update check state ---
  const [updateInfo, setUpdateInfo] = useState(null) // { hasUpdate, latestVersion, apkUrl, hashUrl } | null
  const [android, setAndroid] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // The in-app updater installs an .apk, so it only applies to the native Android build.
    // On iOS and the web this check is skipped and the update row never appears. isAndroid()
    // already answers false off the mobile build; the MOBILE check on top keeps the web bundle
    // from even asking (and from calling gitlab.com on every Settings visit).
    if (!MOBILE) return
    isAndroid().then(ok => { setAndroid(ok); if (ok) checkForUpdate().then(setUpdateInfo).catch(() => {}) })
  }, [])

  // The same check, on demand: the automatic one is silent when it finds nothing or cannot
  // reach gitlab.com, and a person who taps "Check for updates" deserves an answer either way.
  const checkNow = async () => {
    if (checking) return
    setChecking(true)
    try {
      const info = await checkForUpdate()
      setUpdateInfo(info)
      if (!info.hasUpdate) toast(t('You have the latest version.'))
    } catch {
      toast(t('Could not check for updates — are you online?'))
    }
    setChecking(false)
  }

  const onUpdateRowClick = () => {
    if (!updateInfo?.hasUpdate) return
    if (updateInfo.apkUrl) {
      // Start download & install
      const version = updateInfo.latestVersion
      confirmSheet({
        title: t('Update to {0}?', version),
        message: t('The latest version will be downloaded and the installer will open.'),
        confirmText: t('Download & Install'),
        onConfirm: async () => {
          // Open a progress sheet
          let closeProgress = null
          let setProgress = null
          useUI.getState().openSheet(close => {
            closeProgress = close
            return <DownloadProgress ref={fn => { setProgress = fn }} />
          }, { locked: true })
          try {
            // The release always publishes the checksum next to the APK. Without it the file is
            // not installed — a sideloaded binary is exactly the thing that should be verified.
            let expectedHash = null
            if (updateInfo.hashUrl) {
              try {
                const hashRes = await fetch(updateInfo.hashUrl)
                if (hashRes.ok) expectedHash = (await hashRes.text()).split(/\s/)[0]
              } catch (e) { /* reported below */ }
            }
            if (!/^[0-9a-f]{64}$/i.test(expectedHash || '')) throw new Error(t('Checksum not available — not installing'))
            await downloadAndInstall(updateInfo.apkUrl, expectedHash, (received, total) => {
              if (setProgress) setProgress(received, total)
            })
            if (closeProgress) closeProgress()
          } catch (e) {
            if (closeProgress) closeProgress()
            toast(t('Update failed: {0}', e.message))
          }
        },
      })
    } else {
      // Update available but no APK asset — open the releases page
      window.open('https://gitlab.com/DuarteSantos8/opengym/-/releases', '_blank', 'noopener')
    }
  }

  const doExport = async () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
    // WKWebView can't download blob URLs — the native build hands the file to the share sheet.
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }
  const doImport = ev => {
    const f = ev.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result)
        if (!data.workouts || !data.routines) throw new Error('not an openGym backup')
        confirmSheet({ title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true, onConfirm: () => { replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), data), true); toast(t('Backup imported')) } })
      } catch (e) { toast(t('Import failed: {0}', e.message)) }
    }
    rd.readAsText(f)
  }
  //// Neoffice — signing in and out belongs to Frappe now, so the three
  //// handlers that lived here (passkey sign-in, passkey registration, "sign
  //// out everywhere") are gone. Ending sessions on every device is a Frappe
  //// feature the member reaches from their own account settings; duplicating
  //// it here would mean a second session store next to Frappe's.

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Settings')}</h1></div>
    </div>

    {/* ---------- account (demo and mobile builds have nothing to sign in to) ---------- */}
    <Section title={MOBILE ? (user ? t('Your server') : t('Your data')) : DEMO ? t('Demo') : t('Account')}>
      {MOBILE ? (user ? <>
        <Row icon="personCircle" iconTint="var(--grey)" title={user.name} subtitle={t('Synced with your openGym server.')} />
        {user.admin && <Row icon="wrench" iconTint="var(--indigo)" title={t('Admin dashboard')} accessory="chevron" onClick={() => nav('/admin')} />}
        <Row icon="signOut" iconTint="var(--red)" title={t('Disconnect')} danger onClick={() => confirmSheet({
          title: t('Disconnect from your server?'),
          message: t('Your data is synced to your server first, then this device switches back to local-only.'),
          confirmText: t('Disconnect'), danger: true,
          onConfirm: async () => { await disconnectServer(); nav('/home'); toast(t('Disconnected — back to local-only')) },
        })} />
      </> : <>
        <Row icon="lock" iconTint="var(--acc)" title={t('All data stays on this phone')} subtitle={t('No account, no cloud — back it up anytime with Export below.')} />
        <Row icon="link" iconTint="var(--indigo)" title={t('Connect to my server')} subtitle={t('Sync this device to your own self-hosted openGym instead.')} accessory="chevron"
          onClick={() => useUI.getState().openSheet(close => <ConnectSheet close={close} />)} />
      </>) : DEMO ? <>
        <Row icon="sparkles" iconTint="var(--acc)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser — change anything you like.')} />
        <Row icon="reset" iconTint="var(--blue)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host openGym')} subtitle={t('Passkey sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>
        {/* //// Neoffice — the member is signed in with their Neoffice account:
            no passkey to create, no profile to pick. Signing out ends the
            Frappe session and leaves for /login. */}
        <Row icon="personCircle" iconTint="var(--grey)" title={user.name} subtitle={t('Signed in with your Neoffice account.')} />
        <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={() => confirmSheet({ title: t('Sign out?'), message: t('Your journal is saved first, then this device is signed out.'), confirmText: t('Sign out'), danger: true, onConfirm: () => signOut() })} />
      </> : (
        <Row icon="lock" iconTint="var(--grey)" title={t('Signing in…')} />
      )}
    </Section>
    {!user && !DEMO && !MOBILE && <p className="sect-f" style={{ marginTop: -18, marginBottom: 22 }}>{t('Guest mode — data lives only in this browser.')}</p>}

    {/* //// Neoffice — added: reaching your coach. Messaging is Raven, which
         already runs on the instance; this block is a door, not a second
         module. It only shows up if a coach actually follows this member — a
         club that assigned nobody shows no button leading nowhere. */}
    {/* //// Neoffice — added: what the member bought from their club. They come
         here for that as much as for their settings: "how much do I have left",
         "when is my next class". */}
    <MyClub />

    <MyCoach />
    {/* ---------- the Coach on a phone: through the paired server, or with the user's own key ---------- */}
    {MOBILE && <Section title={t('AI Coach')}>
      <Row icon="sparkles" iconTint="var(--acc)" title={t('AI Coach')} accessory="chevron"
        subtitle={coachLocal?.mode === 'server' ? t('Runs on your openGym server') : coachLocal?.mode === 'byok' ? t('Runs on this phone with your own API key') : t('Off — choose how the Coach should run.')}
        onClick={() => nav('/coach/setup')} />
    </Section>}

    {/* ---------- general ---------- */}
    <Section title={t('General')} footer={t('Switching the unit offers to convert every stored weight.')}>
      <SelectRow
        icon="globe" iconTint="var(--blue)" title={t('Language')}
        value={S.lang || 'en'} onChange={v => update(s => { s.lang = v })}
        options={Object.entries(LANGS).map(([k, name]) => ({
          value: k, label: name,
          subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't available in this language yet — they stay in English."),
        }))}
      />
      {/* //// Neoffice — the Classes tab in the bottom bar. Only shows up if
           the club actually RUNS classes: offering to hide something that does
           not exist makes people think they lost it. */}
      {!MOBILE && !DEMO && S.perms?.classes !== false && (
        <Row icon="calendar" iconTint="var(--acc)" title={t('Classes tab')}
          subtitle={t('Shows your club’s classes in the bottom bar.')}>
          <Switch checked={S.classesTab !== false}
            onChange={v => update(s => { s.classesTab = v })} />
        </Row>
      )}
      <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit} onChange={v => switchUnit(v)} />
      </Row>
      {/* Monday or Sunday — the Plan list, the Home strip, the calendar grid and every
          "this week" total follow it. Stored as a getDay() index (see lib/format.js). */}
      <Row icon="calendar" iconTint="var(--orange)" title={t('Week starts on')}>
        <Segmented className="seg-inline"
          options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]}
          value={weekStartOf(S)} onChange={v => update(s => { s.weekStart = v })} />
      </Row>
      {/* Membership QR codes on Home (views/CheckIn.jsx); off = no Home card, no route. */}
      <Row icon="qr" iconTint="var(--blue)" title={t('Gym check-in')}
        subtitle={t('Show a card on Home with your membership QR codes.')}>
        <Switch checked={S.checkIn !== false} onChange={v => update(s => { s.checkIn = v })} />
      </Row>
    </Section>

    {/* ---------- during a workout ---------- */}
    <Section title={t('During a workout')} footer={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : null}>
      {/* One exercise at a time (cards with Prev/Next), the whole session stacked as a
          scrollable list, or that list stripped to just names and set rows (compact).
          Legacy/unknown values read as cards. The running session can override this from
          the workout header's ⋮ menu without changing this default. */}
      <Row icon="list" iconTint="var(--blue)" title={t('Workout view')}>
        <Segmented className="seg-inline"
          options={[{ value: 'cards', label: t('Cards') }, { value: 'list', label: t('List') }, { value: 'compact', label: t('Compact') }]}
          value={['list', 'compact'].includes(S.workoutView) ? S.workoutView : 'cards'}
          onChange={v => update(s => { s.workoutView = v })} />
      </Row>
      {/* The lean workout screen keeps the sets and one "more" button per exercise; each switch
          brings one of the old always-visible button groups back for people who liked them. */}
      <Row icon="wrench" iconTint="var(--purple)" title={t('Workout controls')} accessory="chevron"
        subtitle={t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}
        onClick={() => workoutControlsSheet()} />
      <SelectRow icon="timer" iconTint="var(--orange)" title={t('Rest timer')}
        value={S.restSec} onChange={v => update(s => { s.restSec = v })}
        options={[{ value: 0, label: t('Off') }, ...[60, 90, 120, 150, 180].map(v => ({ value: v, label: v + 's' }))]} />
      {/* Default for a rest-pause burst added live on a plain set — a planned exercise's own
          "Rest (s)" (in its Intensifier config) overrides this, same as the main rest timer
          is the fallback whenever an exercise has no progression rule of its own.
          //// Neoffice — gated on the level. This row put the words "rest-pause"
          //// on a beginner's Settings screen for a technique nothing else at
          //// their level offers. Found by views/jargon.level.test.jsx, which
          //// reads the rendered text rather than checking one rule at a time. */}
      {showsRestPauseSetting(S) && <SelectRow icon="bolt" iconTint="var(--acc)" title={t('Rest-pause rest')}
        value={S.restPauseSec} onChange={v => update(s => { s.restPauseSec = v })}
        options={[10, 15, 20, 30].map(v => ({ value: v, label: v + 's' }))} />}
      {(wakeOK || !MOBILE) && (
        <Row icon="sun" iconTint="var(--yellow)" title={t('Keep screen awake')}
          subtitle={wakeOK ? null : t('Not supported in this browser.')}>
          <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
            onChange={v => update(s => { s.keepAwake = v })} />
        </Row>
      )}
      {/* 'full'/'mini' is also what the tap-toggle on the workout animation writes; 'off' hides
          workout media entirely (library, detail sheet and picker thumbs are unaffected).
          Legacy/unknown values read as 'full'. */}
      {/* //// Neoffice — how much of the journal to show. The client's most
           structural request (31.08): the data is "trop technique" for someone
           starting out, to the point of putting them off.
           A DENSITY control, not a permission and not a skill grade: Simple
           hides the body map and the effort histogram, Complete brings them
           back with all their history. Nothing is deleted, nothing is locked.
           Placed first in this section — it decides what the rest even shows. */}
      <Row icon="lightbulb" iconTint="var(--accent)" title={t('Level of detail')}>
        <Segmented className="seg-inline"
          options={[{ value: 'simple', label: t('Simple') }, { value: 'normal', label: t('Normal') }, { value: 'full', label: t('Advanced') }]}
          value={levelOf(S)}
          onChange={v => update(s => { s.level = v })} />
      </Row>
      {/* //// Neoffice — asking for a weigh-in is OFF by default (see DEF):
           body weight is a sensitive subject, and being made to look at a
           number before every session is not a neutral prompt. This is here
           for whoever WANTS the reminder — the Log button on Home works
           either way. */}
      <Row icon="scale" iconTint="var(--teal)" title={t('Ask me to weigh in')}>
        <Segmented className="seg-inline"
          options={[{ value: 'never', label: t('Never') }, { value: 'week', label: t('Weekly') }, { value: 'workout', label: t('Each session') }]}
          value={S.weighInEvery || 'never'}
          onChange={v => update(s => { s.weighInEvery = v })} />
      </Row>
      <Row icon="figureRun" iconTint="var(--green)" title={t('Exercise animations')}>
        <Segmented className="seg-inline"
          options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]}
          value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
          onChange={v => update(s => { s.gifSize = v })} />
      </Row>
      <Row icon="bell" iconTint="var(--pink)" title={t('Sounds')}>
        <Switch checked={!!S.sound} onChange={v => update(s => { s.sound = v })} />
      </Row>
      <Row icon="sun" iconTint="var(--yellow)" title={t('Flash screen when timer ends')}>
        <Switch checked={!!S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} />
      </Row>
      {/* Two names for the same judgement, so the column asks in the scale you already think in.
          The (i) sits before the control — you read it on the way to the choice, not after it. */}
      {showsEffortSetting(S) && <Row icon="target" iconTint="var(--purple)" title={t('Effort per set')}>
        <button className="helpbtn" aria-label={t('What are RIR and RPE?')} onClick={effortHelpSheet}><Icon name="info" /></button>
        <Segmented className="seg-inline"
          options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
          value={effortOf(S)} onChange={v => update(s => { s.effort = v; delete s.showRir })} />
      </Row>}
    </Section>

    {(user || MOBILE) && <NotificationsCard S={S} update={update} toast={toast} />}

    {/* ---------- equipment ---------- */}
    <EquipmentCard S={S} update={update} />

    {/* ---------- appearance ---------- */}
    <Section title={t('Appearance')} footer={DEMO || MOBILE ? undefined : t('synced with your profile')}>
      <Row icon="moon" iconTint="var(--indigo)" title={t('Theme')}>
        <Segmented
          className="seg-inline"
          options={[
            { value: 'dark', icon: 'moon', label: t('Dark') },
            { value: 'light', icon: 'sun', label: t('Light') },
            { value: 'system', icon: 'gear', label: t('System') },
          ]}
          value={S.theme || 'dark'}
          onChange={v => update(s => { s.theme = v })}
        />
      </Row>
      {/* Purely how the muscle map is drawn — nothing else in the app reads this. */}
      <Row icon="figureStrength" iconTint="var(--teal)" title={t('Body diagram')}>
        <Segmented
          className="seg-inline"
          options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
          value={S.body === 'female' ? 'female' : 'male'}
          onChange={v => update(s => { s.body = v })}
        />
      </Row>
      <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingTop: 13, paddingBottom: 14 }}>
        <span className="lrow-t">{t('Accent color')}</span>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, c]) => (
            <button key={k} className={'swatch' + ((S.accent || 'lime') === k ? ' on' : '')}
              style={{ background: c }} onClick={() => update(s => { s.accent = k })} aria-label={k} />
          ))}
        </div>
      </div>
    </Section>

    {/* ---------- data: fill it, bring things over, back it up, wipe it ---------- */}
    <Section title={t('Data')}>
      <Row icon="sparkles" iconTint="var(--acc)" title={t('Load starter plan')} accessory="chevron" onClick={starterPlanSheet} />
      <Row icon="shuffle" iconTint="var(--teal)" title={t('Import from another app')}
        subtitle={t('FitNotes, Strong, Hevy — or body weight from Apple Health')}
        accessory="chevron" onClick={() => importRef.current.click()} />
      <Row icon="key" iconTint="var(--teal)" title={t('Import from Hevy')}
        subtitle={t('Pull your history with a Hevy Pro API key')}
        accessory="chevron" onClick={importFromHevy} />
      <Row icon="upload" iconTint="var(--blue)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
      <Row icon="download" iconTint="var(--blue)" title={t('Export backup (JSON)')} accessory="chevron" onClick={doExport} />
      {MOBILE && <Row icon="history" iconTint="var(--blue)" title={t('Auto-backup on changes')}
        subtitle={t('Saves a dated copy to the Documents folder after finishing a workout or editing a routine — point a sync app at it, or copy it out by hand.')}>
        <Switch checked={!!S.autoBackup} onChange={v => update(s => { s.autoBackup = v })} />
      </Row>}
      <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={() => confirmSheet({ title: t('Reset everything?'), message: t('Deletes your plan, workouts and body weight on this device. This cannot be undone.'), confirmText: t('Delete everything'), danger: true, onConfirm: () => { replaceState(JSON.parse(JSON.stringify(DEF)), true); nav('/home'); toast(t('All data reset')) } })} />
    </Section>
    <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
    {/* Reset after reading so picking the same file twice still fires onChange. */}
    <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />

    {/* "Add to Home screen" makes no sense inside the native app */}
    {!MOBILE && <Section title={t('Tip')}>
      <Row icon="lightbulb" iconTint="var(--yellow)"
        title={IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : t('In Safari: Share → Add to Home Screen')}
        subtitle={t('to install openGym as a full-screen app.') + ' ' + (user ? t('Your data syncs with your profile — sign in anywhere to see it.') : t('Guest data stays on this device — export a backup now and then!'))} />
    </Section>}

    {/* //// Neoffice — upstream's "Updates" section (APK download, release check
        on gitlab.com) is left out: the club's journal is a web app served by the
        instance and updates with it; a row sending members to an APK on the
        author's site would be a wrong door. The version line below stays. */}
    {/* //// Neoffice — the "source code" link points at OUR fork: AGPL §13 asks
        for the source of THE version that is running, and what runs here is the
        fork. The version number is upstream's addition, kept: on the phone there
        is no address bar, so this line is the only way to tell which build you
        are on. */}
    <div className="dim small" style={{ textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
      openGym v{__APP_VERSION__} · {t('free & open source (AGPL v3)')}<br />
      <a href="https://github.com/bvisible/openGym" target="_blank" rel="noopener">source code</a> · exercise data: hasaneyldrm/exercises-dataset (MIT)<br />
      exercise images and animations © <a href="https://gymvisual.com/" target="_blank" rel="noopener">Gym visual</a>
    </div>
  </div>
}

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left — went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy — warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2

// Settings → During a workout → Workout controls. S.wc overlays DEF.wc, so a profile from
// before this setting existed reads as the lean default.
function WorkoutControlsSheet() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const wc = workoutControls(S)
  const set = (k, v) => update(s => { s.wc = { ...workoutControls(s), [k]: v } })
  return <>
    <h3>{t('Workout controls')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}</div>
    <Section>
      <Row icon="plus" iconTint="var(--acc)" title={t('Weight and reps buttons')} subtitle={t('Off: tap the number and type it')}>
        <Switch checked={wc.steppers} onChange={v => set('steppers', v)} />
      </Row>
      <Row icon="bolt" iconTint="var(--orange)" title={t('Drop and burst shortcuts on every set')}>
        <Switch checked={wc.setShortcuts} onChange={v => set('setShortcuts', v)} />
      </Row>
      <Row icon="link" iconTint="var(--blue)" title={t('Superset buttons in the exercise header')}>
        <Switch checked={wc.pairButtons} onChange={v => set('pairButtons', v)} />
      </Row>
      <Row icon="shuffle" iconTint="var(--teal)" title={t('Move, swap and remove buttons below the exercise')}>
        <Switch checked={wc.exerciseButtons} onChange={v => set('exerciseButtons', v)} />
      </Row>
    </Section>
  </>
}
function workoutControlsSheet() {
  useUI.getState().openSheet(() => <WorkoutControlsSheet />)
}

// Download progress sheet — receives a ref callback that exposes a (received, total) setter.
// Uses forwardRef so the caller can push byte counts in without re-rendering the whole Settings tree.
const DownloadProgress = forwardRef(function DownloadProgress(_, ref) {
  const [pct, setPct] = useState(0)
  const [text, setText] = useState(t('Starting download…'))
  // Expose a setter the caller can invoke directly
  if (ref) ref(function update(received, total) {
    if (total > 0) {
      const p = Math.min(100, Math.round((received / total) * 100))
      setPct(p)
      setText(t('{0} %', p))
    } else {
      setText(t('{0} MB', (received / 1_000_000).toFixed(1)))
    }
  })
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <h3>{t('Downloading update…')}</h3>
      <div style={{ margin: '16px 0', height: 6, borderRadius: 3, background: 'var(--fill-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--acc)', borderRadius: 3, transition: 'width .2s' }} />
      </div>
      <div className="muted small">{text}</div>
    </div>
  )
})

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <h3>{t('Effort per set')}</h3>
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small" style={{ lineHeight: 1.5, display: 'grid', gap: 8 }}>
      <div>{t('RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.')}</div>
    </div>
    <div style={{ height: 8 }} />
  </>)
}

function NotificationsCard({ S, update, toast }) {
  if (MOBILE) return <MobileReminderCard S={S} update={update} toast={toast} />
  return <PushCard S={S} update={update} toast={toast} />
}

// Mobile build: the reminder is a native local notification scheduled on planned weekdays —
// no push server involved. The schedule itself is (re)synced by the store on every persist;
// this card only owns the OS permission prompt when the switch turns on.
function MobileReminderCard({ S, update, toast }) {
  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })
  const toggle = async () => {
    const on = !S.reminder?.on
    if (on) {
      const ok = await syncReminder({ ...S, reminder: { ...(S.reminder || DEF.reminder), on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }
  return (
    <Section title={t('Notifications')}
      footer={S.reminder?.on ? t('Reminds you at this time on days that have a routine planned.') : null}>
      <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
        <Switch checked={!!S.reminder?.on} onChange={toggle} />
      </Row>
      {S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => setReminder({ time: e.target.value })} />
        </Row>
      )}
    </Section>
  )
}

function PushCard({ S, update, toast }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => setOn(!!sub)).catch(() => {})
  }, [supported])

  const toggle = async v => {
    setBusy(true)
    try {
      if (!v) { await disablePush(); setOn(false); toast(t('Notifications off')) }
      else { await enablePush(); setOn(true); toast(t('Notifications on')) }
    } catch (e) { toast(e.message || t('Could not change notification settings')) }
    setBusy(false)
  }
  const test = async () => {
    try { await sendTestPush(); toast(t('Test sent — should arrive any second')) }
    catch (e) { toast(e.message || t('Test failed')) }
  }

  if (!supported) return (
    <Section title={t('Notifications')}>
      <Row icon="bellSlash" iconTint="var(--grey)" title={t('Not supported in this browser.')} />
    </Section>
  )

  return <>
    <Section
      title={t('Notifications')}
      footer={on && S.reminder?.on
        ? t("Only sent on days you have a routine planned and haven't logged a workout yet.") +
          (S.reminder?.tz ? ' ' + t('Timezone: {0} (auto-detected, updates if you travel).', S.reminder.tz) : '')
        : null}
    >
      <Row icon="bell" iconTint="var(--red)" title={t('Push notifications')} subtitle={t('Rest-timer alerts, even if openGym is closed.')}>
        <Switch checked={on} disabled={busy} onChange={toggle} />
      </Row>
      {on && (
        <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
          <Switch checked={!!S.reminder?.on} onChange={() => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), on: !s.reminder?.on, tz: localTZ() } })} />
        </Row>
      )}
      {on && S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), time: e.target.value, tz: localTZ() } })} />
        </Row>
      )}
    </Section>
    {on && <div style={{ marginTop: -12, marginBottom: 22 }}><Button size="sm" icon="bell" onClick={test}>{t('Send test notification')}</Button></div>}
  </>
}

// Equipment profiles ("Home", "Gym", ...) — each an id/name/eq-list; the active one filters
// the Library, exercise picker, and flags routine entries that need something outside it
// (see lib/equipment.js). Purely local/synced state — no server changes needed.
function EquipmentCard({ S, update }) {
  const profiles = S.equipProfiles || []
  //// Neoffice — hidden at the simple level, unless this member already has a
  //// profile: the whole section only makes sense once you own equipment you
  //// want to filter by, and a beginner training at the club owns the club's.
  //// A member who HAS profiles keeps the section — hiding it would silently
  //// leave a filter active with no way to turn it off.
  if (!showsEquipmentProfiles(S)) return null
  const remove = p => confirmSheet({
    title: t('Delete profile?'), message: t('"{0}" and its equipment list will be removed.', p.name),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => update(s => {
      s.equipProfiles = (s.equipProfiles || []).filter(x => x.id !== p.id)
      if (s.activeEquipId === p.id) s.activeEquipId = (s.equipProfiles[0] && s.equipProfiles[0].id) || null
    }),
  })
  return <Section title={t('Equipment')} footer={t('Filters the exercise library and picker, and flags routine exercises that need something you don’t have in the active profile.')}>
    {profiles.length > 0 && <Row icon="dumbbell" iconTint="var(--acc)" title={t('Filter by equipment')}>
      <Switch checked={!!S.equipFilterOn} onChange={v => update(s => { s.equipFilterOn = v })} />
    </Row>}
    {profiles.length > 0 && <SelectRow icon="list" iconTint="var(--blue)" title={t('Active profile')}
      value={S.activeEquipId || ''} onChange={v => update(s => { s.activeEquipId = v })}
      options={profiles.map(p => ({ value: p.id, label: p.name }))} />}
    {profiles.map(p => (
      <Row key={p.id} icon="dumbbell" iconTint="var(--teal)" title={p.name}
        subtitle={t('{0} equipment types', p.equipment.length)} accessory="chevron"
        onClick={() => equipmentProfileSheet(p)}>
        <button className="iconbtn" aria-label={t('Delete')} onClick={ev => { ev.stopPropagation(); remove(p) }}><Icon name="trash" /></button>
      </Row>
    ))}
    <Row icon="plus" iconTint="var(--acc)" title={t('Add equipment profile')} accessory="chevron" onClick={() => equipmentProfileSheet(null)} />
  </Section>
}

//// Neoffice — RegisterInline and PairSheet removed. The first created a passkey
//// profile and asked for an invite code; the second minted a code for upstream's
//// mobile app to pair with a Node server. Accounts here are Frappe accounts — a
//// member exists because the club created them — and the journal is served by
//// the very instance it talks to, so there is nothing to sign up for and no
//// second server to pair with.


//// Neoffice — added: who follows this member, and how to write to them.
function MyCoach() {
  const [coach, setCoach] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    myCoach()
      .then(r => { if (alive) setCoach(r.coach) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  if (!coach) return null

  const write = async () => {
    setBusy(true)
    try {
      const r = await openChat()
      //// Raven is another application on the same site: we GO there, we do
      //// not embed it. A new tab would leave the logbook open behind, with two
      //// possible threads for the same conversation.
      window.location.href = r.url
    } catch (e) {
      toast(e.message || t('Could not open the conversation.'))
      setBusy(false)
    }
  }

  return <Section title={t('Your coach')}>
    <Row icon="personCircle" iconTint="var(--acc)" title={coach.name}
      subtitle={coach.reachable ? t('Follows your training') : t('Follows your training — no account for messages')} />
    {coach.reachable && <Row icon="bell" iconTint="var(--blue)" title={t('Write to your coach')}
      subtitle={t('Opens the club’s messaging')} accessory="chevron" onClick={busy ? undefined : write} />}
  </Section>
}


//// Neoffice — added: the "club" half of the account.
//// The balance first, the coming classes after: the first answers "can I still
//// book", the second "what have I got planned".
//// The whole block disappears when there is neither a pass nor a class — a
//// member whose club runs no classes should not have to read an empty
//// section.
function MyClub() {
  const [bal, setBal] = useState(null)
  const [next, setNext] = useState([])
  const S = useStore(s => s.S)
  const nav = useNavigate()

  useEffect(() => {
    if (MOBILE || DEMO) return
    let alive = true
    wallet().then(r => { if (alive) setBal(r) }).catch(() => {})
    if (S.perms?.classes !== false) {
      classesMine().then(l => { if (alive) setNext(Array.isArray(l) ? l.slice(0, 3) : []) }).catch(() => {})
    }
    return () => { alive = false }
  }, [S.perms && S.perms.classes])

  const hasPack = bal && bal.available && bal.sessionsLeft > 0
  if (!hasPack && !next.length) return null

  return <Section title={t('Your club')}>
    {hasPack && <Row icon="trophy" iconTint="var(--acc)"
      title={t(bal.sessionsLeft === 1 ? '{0} class left' : '{0} classes left', bal.sessionsLeft)}
      subtitle={bal.expiresOn ? t('valid until {0}', bal.expiresOn) : null} />}
    {next.map(c => <Row key={c.id} icon="calendar" iconTint="var(--blue)"
      title={c.title}
      subtitle={c.start ? new Date(c.start).toLocaleString(dateLocale(), {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      }) : null}
      accessory="chevron" onClick={() => nav('/classes')} />)}
  </Section>
}
