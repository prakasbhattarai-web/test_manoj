/**
 * In-memory data store for the booking system.
 * Holds services and appointments. No external database required.
 */

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Services catalogue
// ---------------------------------------------------------------------------
const services = [
  {
    id: 'svc-001',
    name: 'General Consultation',
    description: 'One-on-one consultation session with a specialist.',
    duration: 60, // minutes
    price: 75.00,
    category: 'Consultation',
  },
  {
    id: 'svc-002',
    name: 'Haircut & Styling',
    description: 'Full haircut and professional styling service.',
    duration: 60,
    price: 45.00,
    category: 'Hair',
  },
  {
    id: 'svc-003',
    name: 'Deep Tissue Massage',
    description: 'Therapeutic deep-tissue massage for muscle relief.',
    duration: 60,
    price: 90.00,
    category: 'Wellness',
  },
  {
    id: 'svc-004',
    name: 'Facial Treatment',
    description: 'Rejuvenating facial treatment for all skin types.',
    duration: 60,
    price: 65.00,
    category: 'Beauty',
  },
  {
    id: 'svc-005',
    name: 'Personal Training',
    description: 'One-on-one personalised fitness training session.',
    duration: 60,
    price: 55.00,
    category: 'Fitness',
  },
  {
    id: 'svc-006',
    name: 'Nutritional Coaching',
    description: 'Expert advice on diet and healthy eating habits.',
    duration: 60,
    price: 60.00,
    category: 'Wellness',
  },
];

// ---------------------------------------------------------------------------
// Appointments store
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} */
const appointmentsMap = new Map();

// Pre-populate a couple of demo appointments so the list is not empty.
const demoAppointments = [
  {
    id: uuidv4(),
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    serviceId: 'svc-001',
    date: '2026-06-15',
    timeSlot: '09:00',
    notes: 'First-time visitor.',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    name: 'Bob Smith',
    email: 'bob@example.com',
    phone: '555-0202',
    serviceId: 'svc-003',
    date: '2026-06-15',
    timeSlot: '11:00',
    notes: '',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

demoAppointments.forEach((a) => appointmentsMap.set(a.id, a));

// ---------------------------------------------------------------------------
// Store API
// ---------------------------------------------------------------------------

const store = {
  // --- Services ---
  getAllServices() {
    return [...services];
  },

  getServiceById(id) {
    return services.find((s) => s.id === id) || null;
  },

  // --- Appointments ---
  getAllAppointments() {
    return Array.from(appointmentsMap.values());
  },

  getAppointmentById(id) {
    return appointmentsMap.get(id) || null;
  },

  /**
   * Returns all booked time slots for a given date (and optionally serviceId).
   * Used by the availability checker.
   */
  getBookedSlots(date, serviceId) {
    const results = [];
    for (const appt of appointmentsMap.values()) {
      if (appt.date === date && appt.status !== 'cancelled') {
        if (!serviceId || appt.serviceId === serviceId) {
          results.push(appt.timeSlot);
        }
      }
    }
    return results;
  },

  createAppointment(data) {
    const now = new Date().toISOString();
    const appointment = {
      id: uuidv4(),
      ...data,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    };
    appointmentsMap.set(appointment.id, appointment);
    return appointment;
  },

  updateAppointment(id, data) {
    const existing = appointmentsMap.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...data,
      id: existing.id,            // id is immutable
      createdAt: existing.createdAt, // createdAt is immutable
      updatedAt: new Date().toISOString(),
    };
    appointmentsMap.set(id, updated);
    return updated;
  },

  cancelAppointment(id) {
    const existing = appointmentsMap.get(id);
    if (!existing) return null;

    const cancelled = {
      ...existing,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    appointmentsMap.set(id, cancelled);
    return cancelled;
  },
};

module.exports = store;
