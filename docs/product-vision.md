# Da Nang Blockchain Hub — Product Vision

## What it is

The member portal for the Da Nang Blockchain Hub coworking space. Members book desks,
meeting rooms, podcast rooms, and the event space; organize community events; and manage
their profiles — while hub admins approve bookings and events, manage members and
amenities, and keep the space running without spreadsheets or chat threads.

## Who uses it

- **Members** — builders, founders, and remote workers at the hub: people who need a desk
  for the day, a meeting room for an hour, or the main hall for a community event.
- **Admins** — the hub operations team: people who approve bookings and event requests,
  configure amenities and hours, and manage the member roster.
- **Visitors** — the public homepage shows amenities, upcoming events, and resident
  projects to prospective members.

## Jobs-to-be-done

- **Book a workspace in seconds** — pick an amenity, see live availability, reserve a
  slot or a weekly/monthly fixed-desk plan, and check in on the day.
- **Run a community event** — submit an event with a banner, get an approval decision by
  email and in-app, manage attendees and a waitlist that auto-promotes.
- **Keep the space orderly** — admins approve or reject from one dashboard; expired
  bookings auto-complete; conflicts are caught before they happen.
- **Belong anywhere** — sign in with Google, email, or a crypto wallet (EVM/Solana);
  switch between English and Vietnamese; install as a PWA on any phone.

## North star

> A member can go from "I need a desk tomorrow" to a confirmed booking in under
> 30 seconds, and an admin can run the entire space from one screen.

## Current capabilities

| Area | What's built |
|---|---|
| Authentication | Google, email/password, EVM + Solana wallet sign-in (custom-token flow); auto-created member profiles |
| Booking | Slot booking with conflict checks, desk capacity sharing, fixed-desk plans (weekly/monthly), check-in/out, hourly auto-checkout |
| Events | Member-submitted events with admin approval, email + in-app notifications, attendees, waitlist with auto-promotion |
| Admin | Dashboards for members, amenities (photos, hours, capacity), bookings, and event approval |
| Amenities | Desks, meeting rooms, podcast rooms, event space — per-amenity hours, days, slot duration |
| Platform | Dark/light theme, EN/VI i18n, PWA with offline caching, public homepage with projects showcase |

## Boundaries (what it is not)

- Not a payment or billing system — membership and invoicing happen off-app.
- Not a general community forum — conversation stays in the community's existing channels.
- Not a multi-location product — one hub, one timezone (Asia/Ho_Chi_Minh), by design.
