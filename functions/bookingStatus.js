// A create trigger can run after a member cancels or an admin reviews a
// booking. Apply its decision only while the booking is still pending.
const updatePendingBooking = (db, bookingRef, changes) =>
  db.runTransaction(async (tx) => {
    const current = await tx.get(bookingRef);
    if (current.exists && current.data().status === "pending") {
      tx.update(bookingRef, changes);
    }
  });

module.exports = {updatePendingBooking};
