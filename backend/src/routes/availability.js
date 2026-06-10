/**
 * Routes: /api/availability
 */

const express = require('express');
const store = require('../models/store');
const { getAvailableSlots } = require('../utils/slots');
const { validateAvailabilityQuery } = require('../middleware/validate');

const router = express.Router();

// GET /api/availability?date=YYYY-MM-DD[&serviceId=xxx]
router.get('/', validateAvailabilityQuery, (req, res) => {
  try {
    const { date, serviceId } = req.query;

    // Validate date is not in the past
    const inputDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inputDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check availability for past dates',
      });
    }

    // Optionally validate serviceId
    if (serviceId) {
      const service = store.getServiceById(serviceId);
      if (!service) {
        return res.status(400).json({ success: false, message: 'Service not found' });
      }
    }

    const bookedSlots = store.getBookedSlots(date, serviceId || null);
    const availableSlots = getAvailableSlots(date, bookedSlots);

    return res.json({
      success: true,
      data: {
        date,
        serviceId: serviceId || null,
        availableSlots,
        bookedSlots,
        totalSlots: availableSlots.length + bookedSlots.length,
      },
    });
  } catch (err) {
    console.error('GET /availability error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
