import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { HttpError } from '../../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const WORLDS_DIR = path.join(__dirname, '../../../../worlds')

// ─── World helpers ───

export function findWorldDir(worldId: string): string | null {
  if (!fs.existsSync(WORLDS_DIR)) return null

  // Try direct path first
  const direct = path.join(WORLDS_DIR, worldId)
  if (fs.existsSync(path.join(direct, 'world.json'))) return direct

  // Search by world ID in world.json
  const dirs = fs.readdirSync(WORLDS_DIR).filter(d =>
    fs.statSync(path.join(WORLDS_DIR, d)).isDirectory()
  )
  for (const d of dirs) {
    const wp = path.join(WORLDS_DIR, d, 'world.json')
    if (fs.existsSync(wp)) {
      const data = JSON.parse(fs.readFileSync(wp, 'utf-8'))
      if (data.id === worldId) return path.join(WORLDS_DIR, d)
    }
  }
  return null
}

export function loadWorld(worldDir: string): any {
  return JSON.parse(fs.readFileSync(path.join(worldDir, 'world.json'), 'utf-8'))
}

export function saveWorld(worldDir: string, world: any): void {
  fs.writeFileSync(path.join(worldDir, 'world.json'), JSON.stringify(world, null, 2))
}

// ─── World creation ───

export function createWorld(opts: {
  name: string
  art_style: string
}): { world: any; worldDir: string } {
  const worldId = crypto.randomUUID().slice(0, 8)
  const safeName = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const dirName = `${worldId}_${safeName}`
  const worldDir = path.join(WORLDS_DIR, dirName)

  const world = {
    id: worldId,
    name: opts.name,
    art_style: opts.art_style,
    status: 'generating',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  fs.mkdirSync(worldDir, { recursive: true })
  saveWorld(worldDir, world)

  return { world, worldDir }
}

// ─── List all worlds ───

export function listWorlds(): any[] {
  if (!fs.existsSync(WORLDS_DIR)) return []

  const dirs = fs.readdirSync(WORLDS_DIR).filter(d =>
    fs.statSync(path.join(WORLDS_DIR, d)).isDirectory()
  )

  const worlds: any[] = []
  for (const d of dirs) {
    const wp = path.join(WORLDS_DIR, d, 'world.json')
    if (fs.existsSync(wp)) {
      worlds.push(JSON.parse(fs.readFileSync(wp, 'utf-8')))
    }
  }
  return worlds
}

// ─── Resolve world (find + load, or 404) ───

export function resolveWorld(worldId: string): { worldDir: string; world: any } {
  const worldDir = findWorldDir(worldId)
  if (!worldDir) throw new HttpError(404, `World not found: ${worldId}`)
  const world = loadWorld(worldDir)
  return { worldDir, world }
}
