/**
 * Routes: /api/appointments
 */

const express = require('express');
const controller = require('../controllers/appointmentController');
const {
  validateCreateAppointment,
  validateUpdateAppointment,
} = require('../middleware/validate');

const router = express.Router();

// GET  /api/appointments          — list all (supports ?date=&status=&serviceId= filters)
router.get('/', controller.listAppointments);

// GET  /api/appointments/:id      — get single appointment
router.get('/:id', controller.getAppointment);

// POST /api/appointments          — create appointment
router.post('/', validateCreateAppointment, controller.createAppointment);

// PUT  /api/appointments/:id      — update appointment
router.put('/:id', validateUpdateAppointment, controller.updateAppointment);

// DELETE /api/appointments/:id    — cancel appointment
router.delete('/:id', controller.cancelAppointment);

module.exports = router;
