import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#14532d"/>
  <text x="256" y="310" font-family="system-ui,Segoe UI,sans-serif" font-size="200" font-weight="800" fill="#ffffff" text-anchor="middle">OCS</text>
</svg>`

const buf = Buffer.from(svg)

await mkdir(publicDir, { recursive: true })

await sharp(buf).resize(192, 192).png().toFile(join(publicDir, 'pwa-192x192.png'))
await sharp(buf).resize(512, 512).png().toFile(join(publicDir, 'pwa-512x512.png'))
await sharp(buf).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png'))

console.log('PWA icons written to public/')
