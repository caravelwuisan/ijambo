// Génère les icônes PWA (PNG) sans dépendance : carré vert #1E7A46 avec « IJ » en pixels.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// grille 11×11 : lettres I et J
const GLYPH = [
  '11100011111',
  '01000000010',
  '01000000010',
  '01000000010',
  '01000000010',
  '01000000010',
  '01000000010',
  '01000010010',
  '01000010010',
  '01000011110',
  '11100000000',
]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = (table[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  const bg = [0x1e, 0x7a, 0x46] // --green
  const fg = [0xff, 0xff, 0xff]
  const corner = Math.round(size * 0.22)
  const cell = size / 16
  const gx0 = (16 - 11) / 2 // glyphe centré sur grille 16
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0 // filtre none
    for (let x = 0; x < size; x++) {
      // coins arrondis
      let inside = true
      const cx = x < corner ? corner - x : x >= size - corner ? x - (size - corner - 1) : 0
      const cy = y < corner ? corner - y : y >= size - corner ? y - (size - corner - 1) : 0
      if (cx && cy && cx * cx + cy * cy > corner * corner) inside = false

      const gx = Math.floor(x / cell - gx0)
      const gy = Math.floor(y / cell - 2.5)
      const on = inside && GLYPH[gy]?.[gx] === '1'
      const px = inside ? (on ? fg : bg) : [0, 0, 0]
      const o = 1 + x * 4
      row[o] = px[0]
      row[o + 1] = px[1]
      row[o + 2] = px[2]
      row[o + 3] = inside ? 255 : 0
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(resolve(root, 'public', 'icons'), { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(resolve(root, 'public', 'icons', `icon-${size}.png`), makePng(size))
  console.log(`icon-${size}.png généré`)
}
