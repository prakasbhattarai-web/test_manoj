/**
 * Appointment controller — business logic layer between routes and the store.
 */

const store = require('../models/store');
const { generateTimeSlots, isSlotAvailable } = require('../utils/slots');

// ---------------------------------------------------------------------------
// GET /api/appointments
// ---------------------------------------------------------------------------
function listAppointments(req, res) {
  try {
    const { date, status, serviceId } = req.query;

    let appointments = store.getAllAppointments();

    if (date) {
      appointments = appointments.filter((a) => a.date === date);
    }
    if (status) {
      appointments = appointments.filter((a) => a.status === status);
    }
    if (serviceId) {
      appointments = appointments.filter((a) => a.serviceId === serviceId);
    }

    // Sort by date then time slot
    appointments.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.timeSlot.localeCompare(b.timeSlot);
    });

    // Enrich with service info
    const enriched = appointments.map((appt) => ({
      ...appt,
      service: store.getServiceById(appt.serviceId),
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('listAppointments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/appointments/:id
// ---------------------------------------------------------------------------
function getAppointment(req, res) {
  try {
    const appointment = store.getAppointmentById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    return res.json({
      success: true,
      data: { ...appointment, service: store.getServiceById(appointment.serviceId) },
    });
  } catch (err) {
    console.error('getAppointment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/appointments
// ---------------------------------------------------------------------------
function createAppointment(req, res) {
  try {
    const { name, email, phone, serviceId, date, timeSlot, notes } = req.body;

    // Verify the service exists
    const service = store.getServiceById(serviceId);
    if (!service) {
      return res.status(400).json({ success: false, message: 'Service not found' });
    }

    // Verify the slot is valid and available
    const allSlots = generateTimeSlots();
    if (!allSlots.includes(timeSlot)) {
      return res.status(400).json({ success: false, message: `Invalid time slot. Choose from: ${allSlots.join(', ')}` });
    }

    const bookedSlots = store.getBookedSlots(date, serviceId);
    if (!isSlotAvailable(timeSlot, bookedSlots)) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked for the selected service. Please choose another slot.',
      });
    }

    const appointment = store.createAppointment({ name, email, phone, serviceId, date, timeSlot, notes: notes || '' });

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: { ...appointment, service },
    });
  } catch (err) {
    console.error('createAppointment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/appointments/:id
// ---------------------------------------------------------------------------
function updateAppointment(req, res) {
  try {
    const existing = store.getAppointmentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (existing.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled appointment' });
    }

    const { name, email, phone, serviceId, date, timeSlot, notes } = req.body;

    // Resolve new values (fall back to existing if not provided)
    const newServiceId = serviceId || existing.serviceId;
    const newDate = date || existing.date;
    const newTimeSlot = timeSlot || existing.timeSlot;

    // Validate service if changed
    if (serviceId) {
      const service = store.getServiceById(serviceId);
      if (!service) {
        return res.status(400).json({ success: false, message: 'Service not found' });
      }
    }

    // Check slot availability only when date or timeSlot changes
    const slotChanged = (date && date !== existing.date) || (timeSlot && timeSlot !== existing.timeSlot);
    const serviceChanged = serviceId && serviceId !== existing.serviceId;

    if (slotChanged || serviceChanged) {
      const allSlots = generateTimeSlots();
      if (!allSlots.includes(newTimeSlot)) {
        return res.status(400).json({ success: false, message: `Invalid time slot. Choose from: ${allSlots.join(', ')}` });
      }

      // Get booked slots excluding the current appointment
      const bookedSlots = store
        .getBookedSlots(newDate, newServiceId)
        .filter((slot) => {
          // Allow the existing appointment's slot (we are moving away from it)
          if (slot === existing.timeSlot && newDate === existing.date && newServiceId === existing.serviceId) {
            return false;
          }
          return true;
        });

      if (!isSlotAvailable(newTimeSlot, bookedSlots)) {
        return res.status(409).json({
          success: false,
          message: 'This time slot is already booked for the selected service.',
        });
      }
    }

    const updated = store.updateAppointment(req.params.id, {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(serviceId !== undefined && { serviceId }),
      ...(date !== undefined && { date }),
      ...(timeSlot !== undefined && { timeSlot }),
      ...(notes !== undefined && { notes }),
    });

    return res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: { ...updated, service: store.getServiceById(updated.serviceId) },
    });
  } catch (err) {
    console.error('updateAppointment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/appointments/:id
// ---------------------------------------------------------------------------
function cancelAppointment(req, res) {
  try {
    const existing = store.getAppointmentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (existing.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Appointment is already cancelled' });
    }

    const cancelled = store.cancelAppointment(req.params.id);
    return res.json({ success: true, message: 'Appointment cancelled successfully', data: cancelled });
  } catch (err) {
    console.error('cancelAppointment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
};
