'use client'
import { useState } from 'react'

export default function ScannerPage({ params }: { params: { eventId: string } }) {
  const [qr, setQr] = useState('QR-DEMO-1234')
  const [station, setStation] = useState<'dining' | 'seminar'>('dining')
  const [action, setAction] = useState<'in' | 'out'>('in')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_id: params.eventId, qr_code_uid: qr, station, action }),
    })
    const json = await res.json()
    setResult(json)
    setLoading(false)
    
  }

  return (
    <div style={{ maxWidth: 640, margin: '32px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Admin Scanner</h1>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <input value={qr} onChange={(e) => setQr(e.target.value)} placeholder="QR code value" style={{ padding: 8, border: '1px solid #ddd' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={station} onChange={(e) => setStation(e.target.value as any)} style={{ padding: 8 }}>
            <option value="dining">Dining</option>
            <option value="seminar">Seminar</option>
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value as any)} style={{ padding: 8 }}>
            <option value="in">IN</option>
            <option value="out">OUT</option>
          </select>
          <button onClick={submit} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Checking…' : 'Submit'}
          </button>
        </div>
        {result && <pre style={{ background: '#f8f8f8', padding: 12, border: '1px solid #eee', overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </div>
  )
}
