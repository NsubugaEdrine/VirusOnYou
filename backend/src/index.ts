import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { scanRoutes } from './routes/scans.js'
import { deviceRoutes } from './routes/devices.js'
import { threatIntelRoutes } from './routes/threatIntel.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/scans', scanRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/threat-intel', threatIntelRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
