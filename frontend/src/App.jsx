import { useEffect, useMemo, useState } from 'react'
import './App.css'

const today = new Date().toISOString().slice(0, 10)

function App() {
  const [caregivers, setCaregivers] = useState([])
  const [clients, setClients] = useState([])
  const [shifts, setShifts] = useState([])
  const [selectedDate, setSelectedDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    clientId: '',
    date: today,
    startTime: '08:00',
    endTime: '12:00',
    requiredCaregivers: 1,
    notes: '',
  })

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options)
    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.message || 'Request failed')
    }
    return payload
  }

  const availableCaregiversByShift = useMemo(() => {
    return shifts.reduce((acc, shift) => {
      const assignedIds = new Set(shift.assignedCaregiverIds)
      const available = caregivers.filter((caregiver) => !assignedIds.has(caregiver.id))
      acc[shift.id] = available
      return acc
    }, {})
  }, [caregivers, shifts])

  async function loadDashboardData(date) {
    setLoading(true)
    setError('')
    try {
      const [loadedCaregivers, loadedClients, loadedShifts] = await Promise.all([
        fetchJson('/api/caregivers'),
        fetchJson('/api/clients'),
        fetchJson(`/api/shifts?date=${date}`),
      ])
      setCaregivers(loadedCaregivers)
      setClients(loadedClients)
      setShifts(loadedShifts)

      if (!formData.clientId && loadedClients[0]) {
        setFormData((current) => ({ ...current, clientId: loadedClients[0].id }))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: name === 'requiredCaregivers' ? Number(value) : value,
    }))
  }

  const handleCreateShift = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await fetchJson('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      setMessage('Shift created successfully.')
      if (formData.date !== selectedDate) {
        setSelectedDate(formData.date)
      } else {
        await loadDashboardData(selectedDate)
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleAssignCaregiver = async (shiftId, caregiverId) => {
    if (!caregiverId) return
    setMessage('')
    setError('')
    try {
      await fetchJson(`/api/shifts/${shiftId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiverId }),
      })
      setMessage('Caregiver assigned.')
      await loadDashboardData(selectedDate)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleUnassignCaregiver = async (shiftId, caregiverId) => {
    setMessage('')
    setError('')
    try {
      await fetchJson(`/api/shifts/${shiftId}/unassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiverId }),
      })
      setMessage('Caregiver unassigned.')
      await loadDashboardData(selectedDate)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Shift Care Scheduler</h1>
          <p>Coordinate caregivers, clients, and staffing coverage.</p>
        </div>
        <label className="date-filter">
          Viewing Date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
      </header>

      {message && <p className="feedback success">{message}</p>}
      {error && <p className="feedback error">{error}</p>}

      <section className="panel">
        <h2>Create Shift</h2>
        <form className="create-form" onSubmit={handleCreateShift}>
          <label>
            Client
            <select name="clientId" value={formData.clientId} onChange={handleInputChange} required>
              <option value="" disabled>
                Select client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.location})
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
          </label>

          <label>
            Start Time
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              required
            />
          </label>

          <label>
            End Time
            <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} required />
          </label>

          <label>
            Required Caregivers
            <input
              type="number"
              min="1"
              max="10"
              name="requiredCaregivers"
              value={formData.requiredCaregivers}
              onChange={handleInputChange}
              required
            />
          </label>

          <label className="full-width">
            Notes
            <textarea
              name="notes"
              rows="2"
              placeholder="Optional details"
              value={formData.notes}
              onChange={handleInputChange}
            />
          </label>

          <button type="submit" className="primary-btn">
            Add Shift
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Shifts for {selectedDate}</h2>
        {loading ? (
          <p>Loading shifts...</p>
        ) : shifts.length === 0 ? (
          <p>No shifts scheduled for this date.</p>
        ) : (
          <div className="shift-grid">
            {shifts.map((shift) => (
              <article key={shift.id} className="shift-card">
                <div className="shift-meta">
                  <h3>{shift.client?.name || 'Unknown Client'}</h3>
                  <p className="subtle">{shift.client?.location}</p>
                  <p>
                    {shift.startTime} - {shift.endTime}
                  </p>
                  <p className={shift.openSlots === 0 ? 'status-good' : 'status-warn'}>
                    {shift.openSlots === 0 ? 'Fully staffed' : `${shift.openSlots} open slot(s)`}
                  </p>
                </div>

                <div className="assigned-list">
                  <p className="label">Assigned Caregivers</p>
                  {shift.assignedCaregivers.length === 0 ? (
                    <p className="subtle">No caregivers assigned yet.</p>
                  ) : (
                    <ul>
                      {shift.assignedCaregivers.map((caregiver) => (
                        <li key={caregiver.id}>
                          <span>
                            {caregiver.name} ({caregiver.skillLevel})
                          </span>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => handleUnassignCaregiver(shift.id, caregiver.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <label className="label">
                  Assign caregiver
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      handleAssignCaregiver(shift.id, event.target.value)
                      event.target.value = ''
                    }}
                    disabled={shift.openSlots === 0}
                  >
                    <option value="" disabled>
                      {shift.openSlots === 0 ? 'No slots available' : 'Choose caregiver'}
                    </option>
                    {(availableCaregiversByShift[shift.id] || []).map((caregiver) => (
                      <option key={caregiver.id} value={caregiver.id}>
                        {caregiver.name} ({caregiver.skillLevel})
                      </option>
                    ))}
                  </select>
                </label>

                {shift.notes && <p className="notes">Notes: {shift.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
