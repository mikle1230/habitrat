// 用 Upstash Redis（Vercel Marketplace 集成）作为存储后端
// 按 familyCode 分区：key = family:{code}
// 环境变量 KV_REST_API_URL + KV_REST_API_TOKEN 由 Vercel 集成自动注入
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// 家庭码：6 位大写字母数字，不含易混淆字符
const FAMILY_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-cache')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: 按家庭码读取数据 ──
  if (req.method === 'GET') {
    const code = (req.query.code || '').toUpperCase()
    if (!FAMILY_CODE_RE.test(code)) {
      return res.status(400).json({ error: '无效的家庭码格式' })
    }

    try {
      const key = 'family:' + code
      const data = await redis.get(key)
      if (!data) {
        return res.status(200).json({ exists: false })
      }
      return res.status(200).json(data)
    } catch (e) {
      console.error('habit-sync GET error:', e)
      return res.status(500).json({ error: '读取失败' })
    }
  }

  // ── POST: 写入数据 ──
  if (req.method === 'POST') {
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'invalid data' })
    }

    const familyCode = (data.familyCode || '').toUpperCase()
    if (!FAMILY_CODE_RE.test(familyCode)) {
      return res.status(400).json({ error: '无效的家庭码格式' })
    }

    try {
      const serverTs = new Date().toISOString()
      // 不覆盖服务端的 familyCode（客户端可能传了不同的）
      const payload = { ...data, _serverUpdatedAt: serverTs, familyCode }

      const key = 'family:' + familyCode
      await redis.set(key, payload)

      return res.status(200).json({
        ok: true,
        serverUpdatedAt: serverTs,
      })
    } catch (e) {
      console.error('habit-sync POST error:', e)
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
