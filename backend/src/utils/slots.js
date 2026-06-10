/**
 * Time-slot utility functions.
 *
 * Business hours: 09:00 – 17:00, 1-hour slots.
 * Generated slots: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
 */

const BUSINESS_START = 9;  // 09:00
const BUSINESS_END = 17;   // last slot starts at 16:00 (ends 17:00)

/**
 * Returns all possible time slots as "HH:MM" strings.
 * @returns {string[]}
 */
function generateTimeSlots() {
  const slots = [];
  for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return slots;
}

/**
 * Returns true when `slot` is NOT in the `bookedSlots` list.
 * @param {string} slot       - "HH:MM"
 * @param {string[]} bookedSlots
 * @returns {boolean}
 */
function isSlotAvailable(slot, bookedSlots) {
  return !bookedSlots.includes(slot);
}

/**
 * Given a date string (YYYY-MM-DD) and an array of already-booked "HH:MM" strings,
 * returns the subset of all slots that are still available.
 *
 * If the date is today, slots in the past (based on current time) are also excluded.
 *
 * @param {string}   dateStr     - "YYYY-MM-DD"
 * @param {string[]} bookedSlots - already booked "HH:MM" values for that date
 * @returns {string[]}
 */
function getAvailableSlots(dateStr, bookedSlots) {
  const all = generateTimeSlots();
  const today = new Date();
  const inputDate = new Date(dateStr + 'T00:00:00');

  const isToday =
    today.getFullYear() === inputDate.getFullYear() &&
    today.getMonth() === inputDate.getMonth() &&
    today.getDate() === inputDate.getDate();

  return all.filter((slot) => {
    if (bookedSlots.includes(slot)) return false;

    // For today, hide slots that have already passed (give 30 min buffer)
    if (isToday) {
      const [h] = slot.split(':').map(Number);
      const slotTime = new Date(dateStr + `T${slot}:00`);
      const buffer = new Date(today.getTime() + 30 * 60 * 1000);
      if (slotTime <= buffer) return false;
    }

    return true;
  });
}

module.exports = { generateTimeSlots, isSlotAvailable, getAvailableSlots };
