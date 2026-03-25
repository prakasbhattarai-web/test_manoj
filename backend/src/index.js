const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const caregivers = [
  { id: "cg-1", name: "Ava Thompson", skillLevel: "RN" },
  { id: "cg-2", name: "Mia Patel", skillLevel: "CNA" },
  { id: "cg-3", name: "Liam Carter", skillLevel: "HHA" },
  { id: "cg-4", name: "Noah Garcia", skillLevel: "CNA" },
];

const clients = [
  { id: "cl-1", name: "Margaret Lewis", location: "Ward A" },
  { id: "cl-2", name: "Daniel Brooks", location: "Ward B" },
  { id: "cl-3", name: "Sophia Nguyen", location: "Home Visit" },
];

let shiftCounter = 3;
const shifts = [
  {
    id: "sh-1",
    clientId: "cl-1",
    date: "2026-03-26",
    startTime: "08:00",
    endTime: "12:00",
    requiredCaregivers: 2,
    notes: "Medication support and mobility assistance.",
    assignedCaregiverIds: ["cg-1"],
  },
  {
    id: "sh-2",
    clientId: "cl-2",
    date: "2026-03-26",
    startTime: "11:00",
    endTime: "15:00",
    requiredCaregivers: 1,
    notes: "Physical therapy support.",
    assignedCaregiverIds: ["cg-2"],
  },
  {
    id: "sh-3",
    clientId: "cl-3",
    date: "2026-03-27",
    startTime: "09:00",
    endTime: "13:00",
    requiredCaregivers: 1,
    notes: "Routine home wellness check.",
    assignedCaregiverIds: [],
  },
];

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateShiftInput(payload) {
  const { clientId, date, startTime, endTime, requiredCaregivers } = payload;

  if (!clientId || !date || !startTime || !endTime) {
    return "clientId, date, startTime and endTime are required.";
  }

  if (!clients.some((client) => client.id === clientId)) {
    return "clientId is not valid.";
  }

  const requiredCount = Number(requiredCaregivers);
  if (!Number.isInteger(requiredCount) || requiredCount < 1) {
    return "requiredCaregivers must be an integer greater than 0.";
  }

  if (toMinutes(endTime) <= toMinutes(startTime)) {
    return "endTime must be later than startTime.";
  }

  return null;
}

function hasTimeConflict(firstShift, secondShift) {
  if (firstShift.date !== secondShift.date) {
    return false;
  }

  const firstStart = toMinutes(firstShift.startTime);
  const firstEnd = toMinutes(firstShift.endTime);
  const secondStart = toMinutes(secondShift.startTime);
  const secondEnd = toMinutes(secondShift.endTime);

  return firstStart < secondEnd && secondStart < firstEnd;
}

function enrichShift(shift) {
  const client = clients.find((item) => item.id === shift.clientId);
  const assignedCaregivers = shift.assignedCaregiverIds
    .map((id) => caregivers.find((item) => item.id === id))
    .filter(Boolean);

  return {
    ...shift,
    client,
    assignedCaregivers,
    openSlots: Math.max(shift.requiredCaregivers - assignedCaregivers.length, 0),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "shift-care-api" });
});

app.get("/api/caregivers", (_req, res) => {
  res.json(caregivers);
});

app.get("/api/clients", (_req, res) => {
  res.json(clients);
});

app.get("/api/shifts", (req, res) => {
  const { date } = req.query;
  const data = date ? shifts.filter((shift) => shift.date === date) : shifts;
  res.json(data.map(enrichShift));
});

app.post("/api/shifts", (req, res) => {
  const validationError = validateShiftInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  shiftCounter += 1;
  const newShift = {
    id: `sh-${shiftCounter}`,
    clientId: req.body.clientId,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    requiredCaregivers: Number(req.body.requiredCaregivers),
    notes: req.body.notes?.trim() || "",
    assignedCaregiverIds: [],
  };

  shifts.push(newShift);
  return res.status(201).json(enrichShift(newShift));
});

app.patch("/api/shifts/:shiftId/assign", (req, res) => {
  const { shiftId } = req.params;
  const { caregiverId } = req.body;

  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) {
    return res.status(404).json({ message: "Shift not found." });
  }

  const caregiver = caregivers.find((item) => item.id === caregiverId);
  if (!caregiver) {
    return res.status(400).json({ message: "caregiverId is not valid." });
  }

  if (shift.assignedCaregiverIds.includes(caregiverId)) {
    return res.status(409).json({ message: "Caregiver already assigned to this shift." });
  }

  if (shift.assignedCaregiverIds.length >= shift.requiredCaregivers) {
    return res.status(409).json({ message: "Shift is already fully staffed." });
  }

  const conflictingShift = shifts.find(
    (item) =>
      item.id !== shift.id &&
      item.assignedCaregiverIds.includes(caregiverId) &&
      hasTimeConflict(item, shift),
  );

  if (conflictingShift) {
    return res.status(409).json({
      message: `Schedule conflict: caregiver is already assigned to ${conflictingShift.id}.`,
    });
  }

  shift.assignedCaregiverIds.push(caregiverId);
  return res.json(enrichShift(shift));
});

app.patch("/api/shifts/:shiftId/unassign", (req, res) => {
  const { shiftId } = req.params;
  const { caregiverId } = req.body;

  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) {
    return res.status(404).json({ message: "Shift not found." });
  }

  if (!shift.assignedCaregiverIds.includes(caregiverId)) {
    return res.status(404).json({ message: "Caregiver is not assigned to this shift." });
  }

  shift.assignedCaregiverIds = shift.assignedCaregiverIds.filter((id) => id !== caregiverId);
  return res.json(enrichShift(shift));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Shift Care API running on http://localhost:${PORT}`);
});
