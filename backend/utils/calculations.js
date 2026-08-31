/**
 * Core business rules for the Attendance Management System.
 *
 * Shift timings (configurable):
 *   Shift start        : 09:30
 *   Grace period ends  : 09:45  -> after this, employee is marked "Late"
 *   Full day threshold : 8 hours worked
 *   Half day threshold : 4 hours worked  (>=4 and <8 => Half Day, deducts 0.5 leave)
 *   Below 4 hours       => Absent (deducts 1 leave), even if the employee checked in
 */

const SHIFT_START = '09:30:00';
const GRACE_END = '09:45:00';
const FULL_DAY_HOURS = 8;
const HALF_DAY_HOURS = 4;

/** Converts 'HH:MM:SS' to minutes-from-midnight */
function toMinutes(t) {
  const [h, m, s] = t.split(':').map(Number);
  return h * 60 + m + (s || 0) / 60;
}

/** Working hours between two 'HH:MM:SS' strings (handles same-day only) */
function calculateWorkingHours(checkIn, checkOut) {
  const diffMinutes = toMinutes(checkOut) - toMinutes(checkIn);
  const hours = diffMinutes / 60;
  return Math.max(0, Math.round(hours * 100) / 100);
}

/**
 * Determines status + leave deduction once check-out happens.
 * Returns { status, leaveDeducted }
 */
function evaluateAttendance(checkIn, workingHours) {
  const isLateArrival = toMinutes(checkIn) > toMinutes(GRACE_END);

  if (workingHours >= FULL_DAY_HOURS) {
    return { status: isLateArrival ? 'Late' : 'Present', leaveDeducted: 0 };
  }
  if (workingHours >= HALF_DAY_HOURS) {
    return { status: 'Half Day', leaveDeducted: 0.5 };
  }
  return { status: 'Absent', leaveDeducted: 1 };
}

module.exports = {
  SHIFT_START,
  GRACE_END,
  FULL_DAY_HOURS,
  HALF_DAY_HOURS,
  calculateWorkingHours,
  evaluateAttendance,
};
