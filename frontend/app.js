'use strict';

const API = 'http://localhost:3001/api';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  currentStep: 1,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  services: [],
  pendingCancelId: null,
};

// ── DOM helpers ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function showView(view) {
  qsa('.view').forEach((el) => el.classList.add('hidden'));
  $(`view-${view}`).classList.remove('hidden');
  qsa('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'appointments') loadAppointments();
}

// ── Stepper ───────────────────────────────────────────────────────────────
function showStep(n) {
  qsa('.wizard-panel').forEach((el) => el.classList.remove('active'));
  const panel = $(`step-${n}`);
  if (panel) panel.classList.add('active');

  qsa('.stepper .step').forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'completed');
    if (s === n) el.classList.add('active');
    else if (s < n) el.classList.add('completed');
  });

  state.currentStep = n;
}

function showSuccess() {
  qsa('.wizard-panel').forEach((el) => el.classList.remove('active'));
  $('step-success').classList.add('active');
  qsa('.stepper .step').forEach((el) => el.classList.add('completed'));
  loadAppointments();
}

// ── Services ──────────────────────────────────────────────────────────────
async function loadServices() {
  try {
    const res = await fetch(`${API}/services`);
    const json = await res.json();
    state.services = json.data || [];
    renderServices();
  } catch {
    $('services-grid').innerHTML = '<p class="error-text">Failed to load services. Is the API server running on port 3001?</p>';
  }
}

function renderServices() {
  if (!state.services.length) {
    $('services-grid').innerHTML = '<p>No services available.</p>';
    return;
  }
  $('services-grid').innerHTML = state.services.map((s) => `
    <div class="service-card ${state.selectedService?.id === s.id ? 'selected' : ''}" data-id="${s.id}">
      <div class="check-badge">&#10003;</div>
      <div class="svc-category">${s.category}</div>
      <div class="svc-name">${s.name}</div>
      <div class="svc-desc">${s.description}</div>
      <div class="svc-footer">
        <span class="svc-price">$${s.price.toFixed(2)}</span>
        <span class="svc-duration">${s.duration} min</span>
      </div>
    </div>
  `).join('');
  qsa('.service-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.selectedService = state.services.find((s) => s.id === card.dataset.id);
      renderServices();
      $('step1-next').disabled = false;
    });
  });
}

// ── Availability ─────────────────────────────────────────────────────────
async function loadSlots() {
  const date = state.selectedDate;
  if (!date) return;

  $('slots-container').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Checking availability&hellip;</p></div>';
  $('step3-next').disabled = true;
  state.selectedSlot = null;

  try {
    const params = new URLSearchParams({ date });
    if (state.selectedService) params.set('serviceId', state.selectedService.id);
    const res = await fetch(`${API}/availability?${params}`);
    const json = await res.json();
    const slots = json.data?.available || [];
    renderSlots(slots);
    const svc = state.selectedService;
    $('slots-subtitle').textContent = svc
      ? `Available times for ${svc.name} on ${date}`
      : `Available times on ${date}`;
  } catch {
    $('slots-container').innerHTML = '<p class="error-text">Could not fetch availability.</p>';
  }
}

function renderSlots(slots) {
  if (!slots.length) {
    $('slots-container').innerHTML = '<p class="field-hint">No slots available for this date. Please choose another day.</p>';
    return;
  }
  $('slots-container').innerHTML = `<div class="slots-grid">${
    slots.map((s) => `<button class="slot-btn" data-slot="${s}">${s}</button>`).join('')
  }</div>`;
  qsa('.slot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedSlot = btn.dataset.slot;
      qsa('.slot-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('step3-next').disabled = false;
    });
  });
}

// ── Confirmation preview ──────────────────────────────────────────────────
function fillConfirmation() {
  const svc = state.selectedService;
  const name  = $('input-name').value.trim();
  const email = $('input-email').value.trim();
  const phone = $('input-phone').value.trim();
  const notes = $('input-notes').value.trim();

  $('conf-service').textContent = svc ? svc.name : '—';
  $('conf-date').textContent    = state.selectedDate || '—';
  $('conf-time').textContent    = state.selectedSlot || '—';
  $('conf-price').textContent   = svc ? `$${svc.price.toFixed(2)}` : '—';
  $('conf-name').textContent    = name  || '—';
  $('conf-email').textContent   = email || '—';
  $('conf-phone').textContent   = phone || '—';
  $('conf-notes').textContent   = notes || '—';
  $('conf-notes-row').style.display = notes ? '' : 'none';

  $('booking-alert').classList.add('hidden');
  $('booking-alert').textContent = '';
}

// ── Validation ────────────────────────────────────────────────────────────
function validateDetails() {
  let ok = true;
  const name  = $('input-name').value.trim();
  const email = $('input-email').value.trim();
  const phone = $('input-phone').value.trim();

  $('err-name').textContent  = '';
  $('err-email').textContent = '';
  $('err-phone').textContent = '';
  $('input-name').classList.remove('invalid');
  $('input-email').classList.remove('invalid');
  $('input-phone').classList.remove('invalid');

  if (!name) {
    $('err-name').textContent = 'Full name is required.';
    $('input-name').classList.add('invalid');
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('err-email').textContent = 'A valid email address is required.';
    $('input-email').classList.add('invalid');
    ok = false;
  }
  if (!phone) {
    $('err-phone').textContent = 'Phone number is required.';
    $('input-phone').classList.add('invalid');
    ok = false;
  }
  return ok;
}

// ── Submit booking ────────────────────────────────────────────────────────
async function submitBooking() {
  const btnText    = $('confirm-btn-text');
  const btnSpinner = $('confirm-btn-spinner');
  const btn        = $('btn-confirm-booking');
  btn.disabled     = true;
  btnText.textContent = 'Booking…';
  btnSpinner.classList.remove('hidden');

  const alert = $('booking-alert');
  alert.classList.add('hidden');

  try {
    const body = {
      name:      $('input-name').value.trim(),
      email:     $('input-email').value.trim(),
      phone:     $('input-phone').value.trim(),
      notes:     $('input-notes').value.trim(),
      serviceId: state.selectedService.id,
      date:      state.selectedDate,
      timeSlot:  state.selectedSlot,
    };
    const res = await fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.errors?.[0]?.msg || 'Booking failed');

    const svc = state.selectedService;
    $('success-summary').innerHTML = `
      <div class="summ-row"><span class="summ-label">Service</span><span class="summ-val">${svc.name}</span></div>
      <div class="summ-row"><span class="summ-label">Date</span><span class="summ-val">${state.selectedDate}</span></div>
      <div class="summ-row"><span class="summ-label">Time</span><span class="summ-val">${state.selectedSlot}</span></div>
    `;
    showSuccess();
    showToast('Appointment booked successfully!', 'success');
  } catch (err) {
    alert.textContent = err.message;
    alert.className = 'alert alert-error';
    alert.classList.remove('hidden');
    btn.disabled = false;
    btnText.textContent = 'Confirm Booking';
    btnSpinner.classList.add('hidden');
  }
}

// ── Appointments list ─────────────────────────────────────────────────────
let allAppointments = [];

async function loadAppointments() {
  $('appointments-container').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading appointments&hellip;</p></div>';
  try {
    const res  = await fetch(`${API}/appointments`);
    const json = await res.json();
    allAppointments = json.data || [];
    renderAppointments(filterAppointments());
  } catch {
    $('appointments-container').innerHTML = '<p class="error-text">Failed to load appointments.</p>';
  }
}

function filterAppointments() {
  const status = $('filter-status').value;
  const date   = $('filter-date').value;
  return allAppointments.filter((a) => {
    if (status && a.status !== status) return false;
    if (date && a.date !== date) return false;
    return true;
  });
}

function serviceNameById(id) {
  const s = state.services.find((sv) => sv.id === id);
  return s ? s.name : id;
}

function renderAppointments(list) {
  if (!list.length) {
    $('appointments-container').innerHTML = '<div class="empty-state"><p>No appointments found.</p></div>';
    return;
  }
  const sorted = [...list].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.timeSlot.localeCompare(b.timeSlot)
  );
  $('appointments-container').innerHTML = `
    <div class="appt-table-wrap">
      <table class="appt-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Service</th>
            <th>Date &amp; Time</th>
            <th class="col-phone">Phone</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((a) => `
            <tr class="${a.status === 'cancelled' ? 'is-cancelled' : ''}">
              <td>
                <div class="appt-name">${a.name}</div>
                <div class="appt-email">${a.email}</div>
              </td>
              <td>${serviceNameById(a.serviceId)}</td>
              <td>${a.date}<br><small>${a.timeSlot}</small></td>
              <td class="col-phone">${a.phone || '—'}</td>
              <td><span class="badge badge-${a.status}">${a.status}</span></td>
              <td>
                ${a.status !== 'cancelled'
                  ? `<button class="btn btn-danger btn-sm" data-cancel="${a.id}">Cancel</button>`
                  : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  qsa('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => openCancelModal(btn.dataset.cancel));
  });
}

// ── Cancel modal ──────────────────────────────────────────────────────────
function openCancelModal(id) {
  state.pendingCancelId = id;
  const appt = allAppointments.find((a) => a.id === id);
  if (appt) {
    $('modal-appt-details').innerHTML = `
      <strong>${serviceNameById(appt.serviceId)}</strong><br>
      ${appt.date} at ${appt.timeSlot}<br>
      ${appt.name}
    `;
  }
  $('cancel-modal').classList.remove('hidden');
}

function closeCancelModal() {
  $('cancel-modal').classList.add('hidden');
  state.pendingCancelId = null;
  $('modal-btn-text').textContent = 'Yes, Cancel It';
  $('modal-btn-spinner').classList.add('hidden');
  $('modal-cancel-confirm-btn').disabled = false;
}

async function confirmCancel() {
  if (!state.pendingCancelId) return;
  $('modal-cancel-confirm-btn').disabled = true;
  $('modal-btn-spinner').classList.remove('hidden');
  $('modal-btn-text').textContent = 'Cancelling…';

  try {
    const res = await fetch(`${API}/appointments/${state.pendingCancelId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Cancel failed');
    closeCancelModal();
    showToast('Appointment cancelled.', 'info');
    await loadAppointments();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    closeCancelModal();
  }
}

// ── Reset wizard ─────────────────────────────────────────────────────────
function resetWizard() {
  state.selectedService = null;
  state.selectedDate = null;
  state.selectedSlot = null;
  $('input-name').value  = '';
  $('input-email').value = '';
  $('input-phone').value = '';
  $('input-notes').value = '';
  $('notes-counter').textContent = '0 / 500';
  $('booking-date').value = '';
  $('step1-next').disabled = true;
  $('step2-next').disabled = true;
  $('step3-next').disabled = true;
  $('slots-container').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Checking availability&hellip;</p></div>';
  renderServices();
  showStep(1);
}

// ── Wire up events ────────────────────────────────────────────────────────

// Nav
qsa('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// Step 1
$('step1-next').addEventListener('click', () => {
  if (!state.selectedService) return;
  showStep(2);
});

// Step 2
$('step2-back').addEventListener('click', () => showStep(1));
$('booking-date').addEventListener('change', (e) => {
  state.selectedDate = e.target.value;
  state.selectedSlot = null;
  $('step2-next').disabled = !state.selectedDate;
});
$('step2-next').addEventListener('click', () => {
  showStep(3);
  loadSlots();
});

// Step 3
$('step3-back').addEventListener('click', () => showStep(2));
$('step3-next').addEventListener('click', () => {
  if (!state.selectedSlot) return;
  showStep(4);
});

// Step 4
$('step4-back').addEventListener('click', () => showStep(3));
$('step4-next').addEventListener('click', () => {
  if (!validateDetails()) return;
  fillConfirmation();
  showStep(5);
});

// Notes character counter
$('input-notes').addEventListener('input', () => {
  $('notes-counter').textContent = `${$('input-notes').value.length} / 500`;
});

// Step 5
$('step5-back').addEventListener('click', () => showStep(4));
$('btn-confirm-booking').addEventListener('click', submitBooking);

// Success
$('btn-book-another').addEventListener('click', () => { resetWizard(); showView('book'); });
$('btn-view-appointments-after').addEventListener('click', () => showView('appointments'));

// Appointments view
$('btn-new-booking').addEventListener('click', () => { resetWizard(); showView('book'); });
$('btn-refresh-list').addEventListener('click', loadAppointments);
$('btn-clear-filters').addEventListener('click', () => {
  $('filter-status').value = '';
  $('filter-date').value   = '';
  renderAppointments(allAppointments);
});
$('filter-status').addEventListener('change', () => renderAppointments(filterAppointments()));
$('filter-date').addEventListener('change', () => renderAppointments(filterAppointments()));

// Cancel modal
$('modal-keep-btn').addEventListener('click', closeCancelModal);
$('modal-cancel-confirm-btn').addEventListener('click', confirmCancel);
$('cancel-modal').addEventListener('click', (e) => {
  if (e.target === $('cancel-modal')) closeCancelModal();
});

// ── Set min date ──────────────────────────────────────────────────────────
$('booking-date').min = new Date().toISOString().split('T')[0];

// ── Init ──────────────────────────────────────────────────────────────────
(async function init() {
  showStep(1);
  await loadServices();
})();
