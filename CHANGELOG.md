# Changelog

Notable changes to the Da Nang Blockchain Hub member portal. Versions follow
[semver](https://semver.org); see README → Versions & Releases. Each
`## v<version>` section becomes that version's GitHub release notes.

## v1.0.0 — 2026-10-29

The first versioned release. It covers everything already in production,
plus today's desk-plan work: Partner Desks, Fixed Desk renewals, and the
monthly coworking limit.

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
- **Booking time, desk and plan details are locked once a booking is
  created.**
- **The Firestore rules tests run in CI** on every pull request and every
  push to `main`. (#121)

### Under the hood

- **The app has a version.** The footer shows the version and build commit,
  for example `v1.0.0 (38164ca)`. Each released version is tagged in git and
  published as a GitHub release.
