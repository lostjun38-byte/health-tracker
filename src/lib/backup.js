import { validateBackup, validateData } from './validation.js'

const KDF = 'PBKDF2-150k-SHA256'

function toBase64(bytes) {
  const chunks = []
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
  }
  return btoa(chunks.join(''))
}

function fromBase64(value) {
  if (typeof value !== 'string') throw new Error('加密备份格式不正确')
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function deriveKey(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持备份加密，请使用 HTTPS 或本机地址打开应用')
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encodeBackup(data, { password = null } = {}) {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: validateData(data) })
  if (password === null) return payload
  if (typeof password !== 'string' || password.length < 6) throw new Error('加密密码至少 6 位')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload))
  return JSON.stringify({ encrypted: true, kdf: KDF, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) })
}

export async function decodeBackup(text, password = '') {
  let payload
  try { payload = JSON.parse(text) } catch { throw new Error('备份不是有效的 JSON 文件') }
  if (payload?.encrypted === true) {
    if (payload.kdf !== KDF) throw new Error('不支持的备份加密格式')
    if (!password) throw new Error('请先填写解密密码')
    const salt = fromBase64(payload.salt)
    const iv = fromBase64(payload.iv)
    if (salt.length !== 16 || iv.length !== 12) throw new Error('加密备份格式不正确')
    const key = await deriveKey(password, salt)
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(payload.data))
      payload = JSON.parse(new TextDecoder().decode(plain))
    } catch { throw new Error('密码错误或文件已损坏') }
  }
  return validateBackup(payload)
}
