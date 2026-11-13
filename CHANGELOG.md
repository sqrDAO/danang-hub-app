# Changelog

What we ship in the Da Nang Blockchain Hub member portal. Versions follow
[semver](https://semver.org) (see README, Versions & Releases). Each
`## v<version>` section becomes that version's GitHub release notes.

## v1.1.0 (2026-11-13)

This release is about the moment a member arrives, and the trust behind it.
Members can now show the building guard a confirmation of their booking. We
also made sure a booking only goes through once its slot is checked, tied
your account to an email you've confirmed, closed loopholes in bookings and
in the Hub's emails, and made the app hold up better through updates and
weak Wi-Fi.

### Booking confirmation

- **A confirmation for the building guard.** The building's guard checks
  who is heading up to the Hub, and members can now show them a "Booking
  confirmation" instead of explaining. It doesn't replace the building's own
  access rules. On the day of an approved booking, members tap "Entry pass" to
  open it: their name, company, date and time, in Vietnamese so the guard can
  read it at a glance. (#156, #162, #164)
- **Today's bookings come first.** My Bookings now opens with a "Today"
  section, and bookings on My Bookings and the Dashboard show on a new
  ticket-style card. Cancel and Delete show only until a booking starts.
  (#156)

### Bookings

- **Availability is checked before every booking.** Before, if the
  availability check failed (say, on a dropped connection), the booking went
  through anyway, so two bookings could be made for the same room and time.
  Now the app stops and says it couldn't verify availability. If the check
  itself is down, booking pauses until it's back; we'd rather that than have
  two people turn up for one room. (#136)
- **The event hall is booked by creating an event.** It no longer shows
  among the spaces on My Bookings. In its place, a note reads "Need the event
  hall? It is booked by creating an event." with a link to create one. (#171)

### Your email

- **Your email is your sign-in email.** The email on your Profile is now the
  one you sign in with, and it can't be edited there. New email-and-password
  accounts confirm their email on a "Verify your email" screen before using
  the Hub; typed it wrong? Tap "Wrong email? Change it" there. For older
  accounts it's optional: tap "Verify your email" next to your email on
  Profile. Google sign-ins are already verified. Wallet accounts have no
  sign-in email, but can add a contact email for admins and event guests; the
  Hub never sends email to it. (#190, #199)

### Notifications

- **Notifications on more than one phone.** Turn them on in Profile on each
  phone you use, and each one gets your booking and event updates. Before,
  switching them on with a second phone quietly cut off the first. On iPhone,
  add the app to your Home Screen first; the app now walks you through it.
  (#152, #169)

### Closing loopholes

- **Approved bookings stay counted.** An approved booking can no longer be
  cancelled to win back its monthly desk hours. Members can still cancel a
  booking while it awaits approval, and Fixed Desk and Partner Desk bookings
  can be cancelled as before. (#160)
- **No hidden links in event emails.** Text that members type, such as an event
  title, now shows as plain text, so a Hub email can't disguise a link to a
  fake site. (#165)
- **Event emails go only to verified addresses.** The email telling organizers
  whether their event was approved is about their own event, so it's now
  always sent, and the Email notifications switch is gone from Profile. It
  goes only to a verified sign-in email, so no one can point it at someone
  else's inbox. Without one, including on wallet accounts, the update still
  arrives in the bell, and as a push notification on phones where you've
  turned notifications on. (#165, #199)
- **Security updates to our email system.** (#153)

### Reliability

- **No blank screen after an update.** If the app was open when we released
  an update, going to another page now loads the new version instead of
  showing a blank screen. Anything else unexpected shows a "Something went
  wrong" message with a Reload button. (#148)
- **The app opens without a connection.** On a device that has opened the app
  before, reloading it or tapping a notification on a bad connection now shows
  the app instead of the browser's error page. Reload once you're back online
  to see your bookings. (#151)
- **Photo storage cleans itself up.** If the photos the app keeps for quick
  loading fill the space the browser gives the app, they're now cleared
  automatically, so they can't stop the app from storing anything new. (#154)
- **Easier-to-read status badges.** In the light theme, Pending, Approved and
  Completed badges were hard to read against their tinted background. They
  now have proper contrast. (#191)

Built by the sqrDAO team for the builders who call the Hub home. Found a
bug or have an idea? Tell us at the front desk or on Telegram. We read every
one.

LFBUIDL.

Th0dium

## v1.0.0 (2026-10-29)

GM frens. This is our first versioned release: everything already live in
the portal, plus a full day in the trenches on desks. Partner teams now get
their own desk, Fixed Desk renewals go through an admin, and coworking hours
are capped so the shared seats stay fair for everyone.

### Partner Desks

- **Partner teams get their own desk.** Admins add a partner (9AM Games and
  DiiD are the first two) on `/admin/members` and choose its desk in the same
  step. (#115, #127)
- **Booked automatically, every working day.** Everyone attached to a partner
  is booked on its desk Mon to Fri, 9am to 6pm, four weeks ahead, for as long
  as they stay with the team. Detach someone and their upcoming days are
  canceled, with a heads-up. (#116)
- **Reserved for the team.** A partner's desk is hidden from other members,
  and only that team can book it. Admins can still book any desk. A reserved
  desk can't be retyped or deleted until it's released. (#122)
- **Bulk attach by company.** Admins can attach existing members in one go,
  using the company on their profile, including the other names a team goes
  by (DiiD also matches "Trí tuệ số"). (#123)
- **A simpler Partners panel.** Each row shows the team's desk as plain text.
  Change desk confirms how many people will move before anything happens.
  Remove works even with members attached: it detaches them, cancels their
  upcoming partner desk days (they're notified) and frees the desk, all in one
  step, for a team of any size. (#127, #129)

### Fixed Desk renewals

- **Renewals go through an admin.** Members request a renewal from their
  Fixed Desk plan; admins approve or reject it in the new Renewals panel, with
  an optional note. (#117)
- **A pending renewal doesn't hold the seat.** Until it's approved, the desk
  stays open for others. If it fills up in the meantime, we tell the member.
- **A reminder before the plan ends.** Members get a nudge 3 days before
  their last day.
- **No Renew on a reserved desk.** If a plan's desk has since gone to a
  partner team, the plan says so instead of offering Renew. (#122)

### Coworking limit

- **40 hours per month on coworking desks.** The cap covers single and
  recurring hourly bookings (Fixed Desk and Partner Desk plans don't count).
  Months follow Da Nang time. (#119)
- **You see where you stand.** The booking page shows the hours used this
  month and stops a booking that would go over. Anything that slips past the
  page is canceled, and we say how many hours were left.
- **Admins, and bookings an admin makes, are exempt.**

### Security & reliability

- **Stricter checks on member profiles,** both when a profile is created and
  when it's updated. (#118, #120)
- **Bookings are locked once they're made.** Members can cancel their own
  bookings, and that's the only change they can make; fields that admins or
  the server set stay theirs. (#119, #125)
- **The Firestore rules tests run in CI** on every pull request and every
  push to `main`. (#121)

### Fixes

- **Dropdown arrows stay put.** In the light theme the arrow was drawn over
  the selected text, and the admin Bookings status filter had none until you
  clicked it. (#126)

### Under the hood

- **The app has a version now.** The footer shows it with the build commit,
  for example `v1.0.0 (38164ca)`. Every release gets a git tag and a GitHub
  release, built from this file.

Built by the sqrDAO team for the builders who call the Hub home. If something
breaks or you want a feature, tell us at the front desk or on Telegram; we
ship fast.

LFBUIDL.

Castelian
