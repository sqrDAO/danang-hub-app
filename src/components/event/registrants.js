// Pure helpers behind the admin registrants modal (EventRegistrantsModal).

// Turns an event's uid list (attendees or waitlist) into rows, keeping the
// stored order. A uid with no member doc (deleted account) still gets a row,
// with `member: null`, so the list always adds up to the count on the card.
export const resolveRegistrants = (uids, members) => {
  const byId = new Map((members || []).map(member => [member.id, member]))
  return (uids || []).map((uid, index) => ({
    uid,
    position: index + 1,
    member: byId.get(uid) || null
  }))
}

const SEARCHED_FIELDS = ['displayName', 'email', 'company', 'jobTitle', 'phone']

// Case-insensitive match on the fields an admin would search by. Rows keep
// their original `position`. A deleted account can only be found by its uid.
export const filterRegistrants = (rows, query) => {
  const needle = (query || '').trim().toLowerCase()
  if (!needle) return rows
  return rows.filter(({ uid, member }) => {
    const haystack = member ? SEARCHED_FIELDS.map(field => member[field] || '') : [uid]
    return haystack.some(value => String(value).toLowerCase().includes(needle))
  })
}

// Unique, non-empty emails in list order, ready to paste into a mail client.
export const getRegistrantEmails = (rows) => {
  const emails = rows.map(({ member }) => (member?.email || '').trim()).filter(Boolean)
  return [...new Set(emails)]
}
