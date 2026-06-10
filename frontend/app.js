/**
 * BookEase — Frontend Application
 *
 * Plain HTML/CSS/JS, no framework dependencies.
 * Communicates with the Express backend at API_BASE (port 3001).
 */

'use strict';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

const state = {
  currentStep: 1,

  // Wizard selections
  selectedService:  null,   // full service object { id, name, price, duration, … }
  selectedDate:     null,   // "YYYY-MM-DD"
  selectedTimeSlot: null,   // "HH:MM"
  userDetails: {
    name: '', email: '', phone: '', notes: '',
  },

  // Appointments list cache
  allAppointments: [],

  // Pending cancel
  pendingCancelId: null,

  // Available / booked slots for step 3
  availableSlots: [],
  bookedSlots:    [],
};

// ---------------------------------------------------------------------------
// DOM shortcuts
// ---------------------------------------------------------------------------

/** getElementById shorthand */
const $  = (id)  => document.getElementById(id);
/** querySelector shorthand */
const qs = (sel, ctx = document) => ctx.querySelector(sel);
/** querySelectorAll → Array shorthand */
const qa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ---------------------------------------------------------------------------
// Escape helpers (prevent XSS when inserting user/server data into innerHTML)
// ---------------------------------------------------------------------------

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------

function formatDate(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(timeStr) {
  // timeStr: "HH:MM"
  const [h] = timeStr.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmt$(n) {
  return `$${Number(n).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

let _toastTimer = null;

function showToast(msg, type = 'info', ms = 3500) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------------------------------------------------------------------------
// API fetch helper
// ---------------------------------------------------------------------------

async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data;
  try { data = await res.json(); } catch {
    throw new Error(`Non-JSON response from server (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.serverData = data;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// View navigation (Book | Appointments)
// ---------------------------------------------------------------------------

function showView(view) {
  qa('.view').forEach((el) => el.classList.add('hidden'));
  const target = $(`view-${view}`);
  if (target) target.classList.remove('hidden');

  qa('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view)
  );

  if (view === 'appointments') loadAppointments();
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function showStep(n) {
  qa('.wizard-panel').forEach((el) => el.classList.remove('active'));
  const panel = $(`step-${n}`);
  if (panel) {
    panel.classList.add('active');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  qa('.stepper .step').forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'completed');
    if (s === n)  el.classList.add('active');
    if (s < n)    el.classList.add('completed');
  });

  state.currentStep = n;
}

function showSuccessPanel() {
  qa('.wizard-panel').forEach((el) => el.classList.remove('active'));
  const panel = $('step-success');
  if (panel) {
    panel.classList.add('active');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  qa('.stepper .step').forEach((el) => el.classList.add('completed'));
}

// ---------------------------------------------------------------------------
// STEP 1 — Services
// ---------------------------------------------------------------------------

async function loadServices() {
  const grid = $('services-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-state" style="grid-column:1/-1">
      <div class="spinner"></div>
      <p>Loading services&hellip;</p>
    </div>`;

  try {
    const res = await apiFetch('/services');
    renderServices(res.data || []);
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">&#9888;</div>
        <h3>Could not load services</h3>
        <p>${esc(err.message)}</p>
        <button class="btn btn-outline btn-sm" onclick="loadServices()" style="margin-top:.75rem">
          Try again
        </button>
      </div>`;
  }
}

function renderServices(services) {
  const grid = $('services-grid');
  if (!grid) return;

  if (!services.length) {
    grid.innerHTML = '<p class="empty-state">No services available.</p>';
    return;
  }

  grid.innerHTML = services.map((s) => `
    <div class="service-card${state.selectedService?.id === s.id ? ' selected' : ''}"
         data-id="${esc(s.id)}" tabindex="0" role="button"
         aria-label="${esc(s.name)}" aria-pressed="${state.selectedService?.id === s.id}">
      <span class="check-badge">&#10003;</span>
      <div class="svc-category">${esc(s.category)}</div>
      <div class="svc-name">${esc(s.name)}</div>
      <div class="svc-desc">${esc(s.description)}</div>
      <div class="svc-footer">
        <span class="svc-price">${esc(fmt$(s.price))}</span>
        <span class="svc-duration">${esc(String(s.duration))} min</span>
      </div>
    </div>
  `).join('');

  // Re-enable next button if something was already selected
  if (state.selectedService) $('step1-next').disabled = false;

  qa('.service-card', grid).forEach((card) => {
    const select = () => {
      state.selectedService = services.find((s) => s.id === card.dataset.id) || null;
      qa('.service-card', grid).forEach((c) => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      $('step1-next').disabled = false;
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
  });
}

// ---------------------------------------------------------------------------
// STEP 2 — Date picker
// ---------------------------------------------------------------------------

function initDatePicker() {
  const input = $('booking-date');
  if (!input) return;

  input.min = todayStr();

  // Restore previous selection
  if (state.selectedDate) {
    input.value = state.selectedDate;
    $('step2-next').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// STEP 3 — Time slots
// ---------------------------------------------------------------------------

async function loadSlots() {
  const container = $('slots-container');
  const subtitle  = $('slots-subtitle');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Checking availability&hellip;</p>
    </div>`;

  $('step3-next').disabled = true;
  state.selectedTimeSlot = null;

  // Update subtitle
  if (subtitle && state.selectedDate) {
    const svcLabel = state.selectedService ? ` for ${state.selectedService.name}` : '';
    subtitle.textContent = `Available slots on ${formatDate(state.selectedDate)}${svcLabel}`;
  }

  try {
    const params = new URLSearchParams({ date: state.selectedDate });
    if (state.selectedService) params.set('serviceId', state.selectedService.id);

    const res = await apiFetch(`/availability?${params}`);
    const { availableSlots = [], bookedSlots = [] } = res.data || {};
    state.availableSlots = availableSlots;
    state.bookedSlots    = bookedSlots;
    renderSlots(availableSlots, bookedSlots);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9888;</div>
        <h3>Could not load availability</h3>
        <p>${esc(err.message)}</p>
        <button class="btn btn-outline btn-sm" onclick="loadSlots()" style="margin-top:.75rem">Retry</button>
      </div>`;
  }
}

function renderSlots(available, booked) {
  const container = $('slots-container');
  if (!container) return;

  const ALL_HOURS = [9,10,11,12,13,14,15,16];

  if (!available.length && !booked.length) {
    container.innerHTML = `
      <div class="no-slots-msg">
        &#128197; No time slots are available for this date. Please pick another day.
      </div>`;
    return;
  }

  const buttons = ALL_HOURS.map((h) => {
    const slot = `${String(h).padStart(2,'0')}:00`;
    const isAvail   = available.includes(slot);
    const isBooked  = booked.includes(slot);
    const isSelected = state.selectedTimeSlot === slot;

    if (!isAvail && !isBooked) return ''; // past / hidden

    return `
      <button class="slot-btn${isSelected ? ' selected' : ''}"
              data-slot="${esc(slot)}"
              ${!isAvail ? 'disabled' : ''}
              title="${isAvail ? 'Available' : 'Already booked'}">
        ${esc(formatTime(slot))}
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="slots-grid">${buttons || '<p class="field-hint">No slots to display.</p>'}</div>
    <div class="slots-legend">
      <div class="legend-item">
        <div class="legend-dot available"></div>
        <span>Available (${available.length})</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot booked"></div>
        <span>Booked (${booked.length})</span>
      </div>
    </div>`;

  qa('.slot-btn:not(:disabled)', container).forEach((btn) => {
    btn.addEventListener('click', () => {
      qa('.slot-btn', container).forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedTimeSlot = btn.dataset.slot;
      $('step3-next').disabled = false;
    });
  });

  // Restore selection if coming back from a later step
  if (state.selectedTimeSlot) {
    const existing = qs(`[data-slot="${state.selectedTimeSlot}"]`, container);
    if (existing && !existing.disabled) {
      existing.classList.add('selected');
      $('step3-next').disabled = false;
    } else {
      state.selectedTimeSlot = null;
    }
  }
}

// ---------------------------------------------------------------------------
// STEP 4 — User details form
// ---------------------------------------------------------------------------

function initDetailsForm() {
  const fields = { name: 'input-name', email: 'input-email', phone: 'input-phone', notes: 'input-notes' };
  Object.entries(fields).forEach(([key, id]) => {
    const el = $(id);
    if (el) el.value = state.userDetails[key] || '';
  });
  updateNotesCounter();
}

function updateNotesCounter() {
  const notes = $('input-notes');
  const counter = $('notes-counter');
  if (notes && counter) counter.textContent = `${notes.value.length} / 500`;
}

function clearFieldErr(errId) {
  const e = $(errId); if (e) e.textContent = '';
  const inputId = errId.replace('err-', 'input-');
  const i = $(inputId); if (i) i.classList.remove('invalid');
}

function setFieldErr(errId, msg) {
  const e = $(errId); if (e) e.textContent = msg;
  const inputId = errId.replace('err-', 'input-');
  const i = $(inputId); if (i) i.classList.add('invalid');
}

function validateDetails() {
  ['err-name','err-email','err-phone'].forEach(clearFieldErr);
  let ok = true;

  const name  = $('input-name')?.value.trim()  || '';
  const email = $('input-email')?.value.trim() || '';
  const phone = $('input-phone')?.value.trim() || '';

  if (name.length < 2) {
    setFieldErr('err-name', 'Full name is required (at least 2 characters).');
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldErr('err-email', 'A valid email address is required.');
    ok = false;
  }
  if (!phone || !/^[\d\s\-()+.]{7,20}$/.test(phone)) {
    setFieldErr('err-phone', 'A valid phone number is required.');
    ok = false;
  }
  return ok;
}

function collectDetails() {
  state.userDetails = {
    name:  $('input-name')?.value.trim()  || '',
    email: $('input-email')?.value.trim() || '',
    phone: $('input-phone')?.value.trim() || '',
    notes: $('input-notes')?.value.trim() || '',
  };
}

// ---------------------------------------------------------------------------
// STEP 5 — Confirmation review
// ---------------------------------------------------------------------------

function fillConfirmation() {
  const svc = state.selectedService;

  const set = (id, text) => { const el = $(id); if (el) el.textContent = text || '—'; };

  set('conf-service', svc?.name);
  set('conf-date',    state.selectedDate ? formatDate(state.selectedDate) : null);
  set('conf-time',    state.selectedTimeSlot ? formatTime(state.selectedTimeSlot) : null);
  set('conf-price',   svc ? fmt$(svc.price) : null);
  set('conf-name',    state.userDetails.name);
  set('conf-email',   state.userDetails.email);
  set('conf-phone',   state.userDetails.phone);
  set('conf-notes',   state.userDetails.notes);

  const notesRow = $('conf-notes-row');
  if (notesRow) notesRow.style.display = state.userDetails.notes ? '' : 'none';

  const alert = $('booking-alert');
  if (alert) { alert.className = 'alert hidden'; alert.textContent = ''; }
}

// ---------------------------------------------------------------------------
// Submit booking
// ---------------------------------------------------------------------------

async function submitBooking() {
  const btn     = $('btn-confirm-booking');
  const btnTxt  = $('confirm-btn-text');
  const spinner = $('confirm-btn-spinner');
  const alertEl = $('booking-alert');

  if (btn)     btn.disabled = true;
  if (btnTxt)  btnTxt.textContent = 'Booking…';
  if (spinner) spinner.classList.remove('hidden');
  if (alertEl) { alertEl.className = 'alert hidden'; alertEl.textContent = ''; }

  try {
    const payload = {
      serviceId: state.selectedService.id,
      date:      state.selectedDate,
      timeSlot:  state.selectedTimeSlot,
      name:      state.userDetails.name,
      email:     state.userDetails.email,
      phone:     state.userDetails.phone,
      notes:     state.userDetails.notes,
    };

    const res = await apiFetch('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    populateSuccessPanel(res.data);
    showSuccessPanel();
    showToast('Appointment booked successfully!', 'success');

  } catch (err) {
    // Restore button
    if (btn)     btn.disabled = false;
    if (btnTxt)  btnTxt.textContent = 'Confirm Booking';
    if (spinner) spinner.classList.add('hidden');

    let msg = err.message || 'Something went wrong. Please try again.';
    if (err.serverData?.errors?.length) {
      msg = err.serverData.errors.map((e) => e.message || e.msg).join(' ');
    }

    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = msg;
      alertEl.classList.remove('hidden');
    }
  }
}

function populateSuccessPanel(appt) {
  const summary = $('success-summary');
  if (!summary || !appt) return;

  const svc = appt.service || state.selectedService;
  const rows = [
    ['Service', svc?.name  || '—'],
    ['Date',    appt.date  ? formatDate(appt.date) : '—'],
    ['Time',    appt.timeSlot ? formatTime(appt.timeSlot) : '—'],
    ['Name',    appt.name  || '—'],
    ['Email',   appt.email || '—'],
  ];

  summary.innerHTML = rows.map(([label, val]) => `
    <div class="summ-row">
      <span class="summ-label">${esc(label)}</span>
      <span class="summ-val">${esc(val)}</span>
    </div>`).join('');
}

// ---------------------------------------------------------------------------
// Reset wizard to step 1
// ---------------------------------------------------------------------------

function resetWizard() {
  state.selectedService  = null;
  state.selectedDate     = null;
  state.selectedTimeSlot = null;
  state.userDetails      = { name: '', email: '', phone: '', notes: '' };

  ['input-name','input-email','input-phone','input-notes'].forEach((id) => {
    const el = $(id); if (el) el.value = '';
  });
  ['err-name','err-email','err-phone'].forEach(clearFieldErr);

  const bd = $('booking-date'); if (bd) bd.value = '';
  const nc = $('notes-counter'); if (nc) nc.textContent = '0 / 500';

  $('step1-next') && ($('step1-next').disabled = true);
  $('step2-next') && ($('step2-next').disabled = true);
  $('step3-next') && ($('step3-next').disabled = true);

  loadServices();
  showStep(1);
}

// ---------------------------------------------------------------------------
// Appointments list
// ---------------------------------------------------------------------------

async function loadAppointments() {
  const container = $('appointments-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state" style="padding:2.5rem">
      <div class="spinner"></div>
      <p>Loading appointments&hellip;</p>
    </div>`;

  const status     = $('filter-status')?.value || '';
  const dateFilter = $('filter-date')?.value   || '';

  const params = new URLSearchParams();
  if (status)     params.set('status', status);
  if (dateFilter) params.set('date',   dateFilter);

  const query = params.toString() ? `?${params}` : '';

  try {
    const res = await apiFetch(`/appointments${query}`);
    state.allAppointments = res.data || [];
    renderAppointments(state.allAppointments);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state" style="padding:2.5rem">
        <div class="empty-state-icon">&#9888;</div>
        <h3>Could not load appointments</h3>
        <p>${esc(err.message)}</p>
        <p style="margin-top:.5rem;font-size:.8rem;color:var(--gray-400)">
          Make sure the API server is running on port 3001.
        </p>
        <button class="btn btn-outline btn-sm" onclick="loadAppointments()" style="margin-top:.75rem">
          Retry
        </button>
      </div>`;
  }
}

function renderAppointments(list) {
  const container = $('appointments-container');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128197;</div>
        <h3>No appointments found</h3>
        <p>No bookings match your current filters.</p>
      </div>`;
    return;
  }

  const rows = list.map((a) => {
    const svc = a.service;
    const cancelled = a.status === 'cancelled';
    return `
      <tr class="${cancelled ? 'is-cancelled' : ''}">
        <td>
          <div class="appt-name">${esc(a.name)}</div>
          <div class="appt-email">${esc(a.email)}</div>
        </td>
        <td>${esc(svc?.name || a.serviceId)}</td>
        <td>${esc(formatDate(a.date))}</td>
        <td>${esc(formatTime(a.timeSlot))}</td>
        <td class="col-phone">${esc(a.phone || '—')}</td>
        <td><span class="badge badge-${esc(a.status)}">${esc(a.status)}</span></td>
        <td>
          ${!cancelled
            ? `<button class="btn btn-outline btn-sm"
                       data-cancel="${esc(a.id)}"
                       data-name="${esc(a.name)}"
                       data-service="${esc(svc?.name || '')}"
                       data-date="${esc(a.date)}"
                       data-time="${esc(a.timeSlot)}">
                 Cancel
               </button>`
            : '<span style="color:var(--gray-400);font-size:.8rem;">—</span>'}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="appt-table-wrap">
      <table class="appt-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Service</th>
            <th>Date</th>
            <th>Time</th>
            <th class="col-phone">Phone</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  qa('[data-cancel]', container).forEach((btn) => {
    btn.addEventListener('click', () => openCancelModal({
      id:      btn.dataset.cancel,
      name:    btn.dataset.name,
      service: btn.dataset.service,
      date:    btn.dataset.date,
      time:    btn.dataset.time,
    }));
  });
}

// ---------------------------------------------------------------------------
// Cancel modal
// ---------------------------------------------------------------------------

function openCancelModal({ id, name, service, date, time }) {
  state.pendingCancelId = id;

  const details = $('modal-appt-details');
  if (details) {
    details.innerHTML = `
      <strong>${esc(name)}</strong><br/>
      ${esc(service)} &mdash; ${esc(formatDate(date))} at ${esc(formatTime(time))}`;
  }

  $('cancel-modal')?.classList.remove('hidden');
}

function closeCancelModal() {
  $('cancel-modal')?.classList.add('hidden');
  state.pendingCancelId = null;

  const btn = $('modal-cancel-confirm-btn');
  if (btn) btn.disabled = false;
  const txt = $('modal-btn-text');
  if (txt) { txt.textContent = 'Yes, Cancel It'; txt.classList.remove('hidden'); }
  $('modal-btn-spinner')?.classList.add('hidden');
}

async function confirmCancel() {
  const id = state.pendingCancelId;
  if (!id) return;

  const btn     = $('modal-cancel-confirm-btn');
  const btnTxt  = $('modal-btn-text');
  const spinner = $('modal-btn-spinner');

  if (btn)    btn.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Cancelling…';
  if (spinner) spinner.classList.remove('hidden');

  try {
    await apiFetch(`/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeCancelModal();
    showToast('Appointment cancelled successfully.', 'success');
    await loadAppointments();
  } catch (err) {
    closeCancelModal();
    showToast(`Could not cancel: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Wire up all events
// ---------------------------------------------------------------------------

function wireEvents() {

  // ── Nav buttons ──────────────────────────────────────────────
  qa('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // ── Step 1 ───────────────────────────────────────────────────
  $('step1-next')?.addEventListener('click', () => {
    if (!state.selectedService) return;
    initDatePicker();
    showStep(2);
  });

  // ── Step 2 ───────────────────────────────────────────────────
  $('step2-back')?.addEventListener('click', () => showStep(1));

  $('booking-date')?.addEventListener('change', (e) => {
    state.selectedDate = e.target.value || null;
    state.selectedTimeSlot = null; // reset time if date changes
    $('step2-next').disabled = !state.selectedDate;
  });

  $('step2-next')?.addEventListener('click', () => {
    if (!state.selectedDate) return;
    loadSlots();
    showStep(3);
  });

  // ── Step 3 ───────────────────────────────────────────────────
  $('step3-back')?.addEventListener('click', () => showStep(2));

  $('step3-next')?.addEventListener('click', () => {
    if (!state.selectedTimeSlot) return;
    initDetailsForm();
    showStep(4);
  });

  // ── Step 4 ───────────────────────────────────────────────────
  $('step4-back')?.addEventListener('click', () => showStep(3));

  $('input-notes')?.addEventListener('input', updateNotesCounter);

  // Clear errors on input change
  ['input-name','input-email','input-phone'].forEach((id) => {
    $(id)?.addEventListener('input', () => clearFieldErr(id.replace('input-', 'err-')));
  });

  $('step4-next')?.addEventListener('click', () => {
    if (!validateDetails()) return;
    collectDetails();
    fillConfirmation();
    showStep(5);
  });

  // ── Step 5 ───────────────────────────────────────────────────
  $('step5-back')?.addEventListener('click', () => showStep(4));
  $('btn-confirm-booking')?.addEventListener('click', submitBooking);

  // ── Success panel ─────────────────────────────────────────────
  $('btn-book-another')?.addEventListener('click', () => {
    resetWizard();
    showView('book');
  });

  $('btn-view-appointments-after')?.addEventListener('click', () => {
    showView('appointments');
  });

  // ── Appointments view ─────────────────────────────────────────
  $('btn-new-booking')?.addEventListener('click', () => {
    resetWizard();
    showView('book');
  });

  $('btn-refresh-list')?.addEventListener('click', loadAppointments);

  $('btn-clear-filters')?.addEventListener('click', () => {
    const s = $('filter-status'); if (s) s.value = '';
    const d = $('filter-date');   if (d) d.value = '';
    loadAppointments();
  });

  $('filter-status')?.addEventListener('change', loadAppointments);
  $('filter-date')?.addEventListener('change',   loadAppointments);

  // ── Cancel modal ──────────────────────────────────────────────
  $('modal-keep-btn')?.addEventListener('click', closeCancelModal);
  $('modal-cancel-confirm-btn')?.addEventListener('click', confirmCancel);

  $('cancel-modal')?.addEventListener('click', (e) => {
    if (e.target === $('cancel-modal')) closeCancelModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = $('cancel-modal');
      if (modal && !modal.classList.contains('hidden')) closeCancelModal();
    }
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function init() {
  // Set date-input minimum to today
  const bd = $('booking-date');
  if (bd) bd.min = todayStr();

  wireEvents();
  showView('book');
  showStep(1);
  await loadServices();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
