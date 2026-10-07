import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

const syncFilePath = path.resolve(__dirname, '../vendas_sync.json')

function syncPlugin() {
  return {
    name: 'vendas-sync-plugin',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Habilita CORS para o Electron e outros clientes consultarem http://localhost:5173/api/sync-overrides
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.url?.startsWith('/api/sync-overrides') && req.method === 'GET') {
          let data = {}
          try {
            if (fs.existsSync(syncFilePath)) {
              data = JSON.parse(fs.readFileSync(syncFilePath, 'utf-8'))
            }
          } catch {}
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
          return
        }

        if (req.url?.startsWith('/api/sync-overrides') && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: any) => { body += chunk })
          req.on('end', () => {
            try {
              const { vendaId, status, extraData } = JSON.parse(body)
              let current: any = {}
              if (fs.existsSync(syncFilePath)) {
                try { current = JSON.parse(fs.readFileSync(syncFilePath, 'utf-8')) } catch {}
              }
              current[vendaId] = { status, ...(extraData || {}) }
              fs.writeFileSync(syncFilePath, JSON.stringify(current, null, 2), 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(current))
            } catch (err: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }

        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), syncPlugin()],
})
