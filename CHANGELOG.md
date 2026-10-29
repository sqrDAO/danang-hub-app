# Changelog

What we ship in the Da Nang Blockchain Hub member portal. Versions follow
[semver](https://semver.org) (see README, Versions & Releases). Each
`## v<version>` section becomes that version's GitHub release notes.

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
  step. (#127)

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

LFBUIDL.

Castelian
