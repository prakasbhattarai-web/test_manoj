# Shift Care Web Application

A full-stack Shift Care scheduling application with:

- **Frontend:** React.js (Vite)
- **Backend:** Express.js

## Features

- View all scheduled shifts
- Create new shifts for clients
- Assign caregivers to shifts
- Unassign caregivers from shifts
- Staffing status display (open/filled slots)
- Conflict prevention for overlapping caregiver assignments

## Project Structure

```text
/backend   -> Express API
/frontend  -> React client
```

## Run Locally

Install dependencies (already done in this repository, but required on a fresh clone):

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Start frontend and backend together:

```bash
npm run dev
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

## API Endpoints

- `GET /api/health`
- `GET /api/caregivers`
- `GET /api/clients`
- `GET /api/shifts?date=YYYY-MM-DD` (optional query filter)
- `POST /api/shifts`
- `PATCH /api/shifts/:shiftId/assign`
- `PATCH /api/shifts/:shiftId/unassign`
