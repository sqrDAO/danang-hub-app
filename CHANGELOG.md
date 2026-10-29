# Changelog

Notable changes to the Da Nang Blockchain Hub member portal. Versions follow
[semver](https://semver.org); see README → Versions & Releases. Each
`## v<version>` section becomes that version's GitHub release notes.

## v1.0.0 — 2026-10-29

The first versioned release. It covers everything already in production,
plus today's desk-plan work: Partner Desks, Fixed Desk renewals, and the
monthly coworking limit, plus a simpler Partners panel.

### Partner Desks

- **Partner organizations get their own desk.** Admins add partners (such as
  9AM Games and DiiD) on `/admin/members` and pick a desk for each. (#115)
- **Members are booked automatically.** Every member attached to a partner
  is booked on its desk each working day (Mon–Fri, 9am–6pm), four weeks ahead,
  for as long as they stay attached. Detaching a member cancels their upcoming
  days and notifies them. (#116)
- **Partner desks are reserved.** A partner's desk is hidden from other
  members, and only that partner's members can book it. Admins can still book
  any desk. A reserved desk can't be retyped or deleted until it's released in
  the Partners panel. (#122)
- **Bulk attach by company.** Admins can attach existing members in bulk
  from the company on their profile, including other names a partner goes by
  (DiiD also matches "Trí tuệ số"). (#123)
- **A simpler Partners panel.** A partner's desk is chosen when it's added,
  and each row shows the desk as text with a Change desk button that
  confirms how many members will move. Remove now works while members are
  attached: it detaches them, cancels their upcoming partner desk days
  (they're notified) and releases the desk in one step. (#127)

### Fixed Desk renewals

- **Renewing needs admin approval.** Members request a renewal from their
  Fixed Desk plan, and admins approve or reject it from a new Renewals panel,
  with an optional reason. (#117)
- **A pending renewal doesn't hold the desk.** Until it's approved, the seat
  stays free for others. If the desk fills up in the meantime, the member is
  told.
- **Reminder before a plan ends.** Members get a reminder 3 days before their
  plan ends.
- **Renew is hidden on reserved desks.** A plan on a desk that has since been
  reserved for a partner says so, instead of offering Renew. (#122)

### Coworking limit

- **Coworking desk bookings are capped at 40 hours per hub month.** The cap
  applies to single and recurring hourly bookings, not to Fixed Desk or
  Partner Desk plans. (#119)
- **Members see where they stand.** The booking page shows the hours used
  this month and blocks a booking that would go over. A booking that slips
  past the page is cancelled and the member is told how many hours were left.
- **Admins and admin-made bookings are exempt.**

### Security & reliability

- **Member profiles are validated more strictly.** This applies both when a
  profile is created and when it's updated. (#118, #120)
- **Booking details are locked once a booking is created.** Members can
  only cancel their own bookings, and fields set by admins or the server
  can't be set by members. (#119, #125)
- **The Firestore rules tests run in CI** on every pull request and every
  push to `main`. (#121)

### Fixes

- **Dropdown arrows stay in place.** In the light theme, dropdown arrows were
  drawn over the selected text, and the admin Bookings status filter had none
  until clicked. (#126)

### Under the hood

- **The app has a version.** The footer shows the version and build commit,
  for example `v1.0.0 (38164ca)`. Each released version is tagged in git and
  published as a GitHub release.
