// routes/admin.js
const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking'); // your existing model
let Audit = null;
try { Audit = require('../models/Audit'); } catch (e) { /* optional */ }

const router = express.Router();

/* ---------- Date helpers (timezone-safe) ---------- */

// parse flexible date string into local Date at midnight
function parseDateFlexible(s) {
  if (!s) return null;
  if (s instanceof Date) {
    const d = new Date(s);
    d.setHours(0,0,0,0);
    return d;
  }
  // if YYYY-MM-DD (HTML date input)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  // support DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [dd,mm,yyyy] = s.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  }
  // fallback: let Date try, then normalize to local midnight
  const d = new Date(s);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// format local Date to YYYY-MM-DD (no timezone shifts)
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// inclusive array of YYYY-MM-DD (local) from fromStr to toStr
function getDateStringsBetween(fromDateStr, toDateStr) {
  const start = parseDateFlexible(fromDateStr);
  const end = parseDateFlexible(toDateStr);
  if (!start || !end || end < start) return [];
  const arr = [];
  const cur = new Date(start);
  while (cur <= end) {
    arr.push(formatDateLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}

/* ---------- Route ---------- */
/**
 * POST /change-seat
 * body: { email, fromDate, toDate, shifts: ['am'|'pm'|'full'], newSeatId, force?: boolean }
 */
router.post('/change-seat', async (req, res) => {
  const { email, fromDate, toDate, shifts, newSeatId, force } = req.body;

  if (!email || !fromDate || !toDate || !Array.isArray(shifts) || shifts.length === 0 || !newSeatId) {
    return res.status(400).json({ message: 'Missing required fields: email, fromDate, toDate, shifts[], newSeatId' });
  }

  try {
    // parse dates robustly and build inclusive list
    const dates = getDateStringsBetween(fromDate, toDate);
    console.log('Admin change-seat request parsed dates:', { fromDate, toDate, parsedDatesCount: dates.length, sample: dates.slice(0,5) });

    if (dates.length === 0) return res.status(400).json({ message: 'Invalid date range' });

    // 1) fetch user's bookings in date range & shifts
    const userBookings = await Booking.find({
      email,
      date: { $in: dates },
      shift: { $in: shifts }
    }).lean();

    if (!userBookings || userBookings.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this user in the selected range & shifts' });
    }

    // 2) find paid conflicts on newSeatId by other users
    const conflicts = await Booking.find({
      seatId: String(newSeatId),
      date: { $in: dates },
      shift: { $in: shifts },
      status: 'paid',
      email: { $ne: email }
    }).lean();

    if (conflicts.length > 0 && !force) {
      const conflictSummary = conflicts.map(c => ({
        id: c._id,
        seatId: c.seatId,
        date: c.date,
        shift: c.shift,
        email: c.email
      }));
      return res.status(409).json({
        message: 'Conflicts found for the requested seat (set force=true to override).',
        conflictCount: conflictSummary.length,
        conflicts: conflictSummary
      });
    }

    // 3) transaction: delete conflicts (if force) and update user's bookings
    const session = await mongoose.startSession();
    let deletedCount = 0;
    let updatedCount = 0;
    try {
      session.startTransaction();

      if (conflicts.length > 0 && force) {
        const ids = conflicts.map(c => c._id);
        const delRes = await Booking.deleteMany({ _id: { $in: ids } }).session(session);
        deletedCount = delRes.deletedCount || 0;
      }

      const bookingIds = userBookings.map(b => b._id);
      const updateRes = await Booking.updateMany(
        { _id: { $in: bookingIds } },
        { $set: { seatId: String(newSeatId), updatedAt: new Date() } }
      ).session(session);

      updatedCount = updateRes.modifiedCount ?? updateRes.nModified ?? 0;

      // optional audit (non-fatal)
      if (Audit) {
        try {
          await Audit.create([{
            admin: req.user?.email || 'admin',
            action: 'change_seat',
            details: {
              movedUser: email,
              fromDate,
              toDate,
              shifts,
              newSeatId: String(newSeatId),
              force: !!force,
              movedCount: bookingIds.length,
              conflictsDeleted: deletedCount
            },
            createdAt: new Date()
          }], { session });
        } catch (ae) {
          console.error('Audit write failed (non-fatal):', ae);
        }
      }

      await session.commitTransaction();
      session.endSession();

      return res.json({
        message: 'Seat change successful',
        movedBookings: bookingIds.length,
        updatedBookings: updatedCount,
        conflictsHandled: deletedCount
      });
    } catch (trxErr) {
      await session.abortTransaction();
      session.endSession();
      console.error('Transaction error:', trxErr);
      return res.status(500).json({ message: 'Transaction failed', error: trxErr.message || trxErr });
    }

  } catch (err) {
    console.error('Error in /change-seat:', err);
    return res.status(500).json({ message: 'Server error', error: err.message || err });
  }
});

module.exports = router;
