import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { registerVercelRoutes } from './vercel-adapter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '.env') })

const app = express()
const port = Number(process.env.API_PORT ?? 3000)

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)

const apiRoot = path.join(__dirname, '..', 'api')

await registerVercelRoutes(app, apiRoot)

app.listen(port, () => {
  console.log(`[parasys] dev API listening on http://127.0.0.1:${port}`)
})
