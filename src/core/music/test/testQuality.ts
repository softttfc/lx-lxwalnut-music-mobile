import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import type { QualityTestResult } from './types'

/**
 * 验证 URL 是否可访问
 * 使用 HEAD 请求，失败时降级为 GET Range 请求
 */
export const testUrlAccessible = async (url: string, timeout = 8000): Promise<boolean> => {
  if (!url) return false

  const tryRequest = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: method === 'GET' ? { Range: 'bytes=0-1023' } : undefined,
      })
      clearTimeout(timer)
      return res.ok || res.status === 206 || res.status === 416
    } catch {
      clearTimeout(timer)
      return false
    }
  }

  // 先 HEAD，失败再 GET Range
  if (await tryRequest('HEAD')) return true
  return await tryRequest('GET')
}

/**
 * 测试单个音质
 */
export const testSingleQuality = async (
  musicInfo: LX.Music.MusicInfoOnline,
  quality: LX.Quality,
  options: { verifyUrl?: boolean } = {}
): Promise<QualityTestResult> => {
  const { verifyUrl = true } = options
  const declared = !!musicInfo.meta._qualitys[quality]
  const start = Date.now()

  try {
    const result = await musicSdk[musicInfo.source]
      .getMusicUrl(toOldMusicInfo(musicInfo), quality)
      .promise

    const url = result?.url || ''
    const urlObtained = !!url
    const urlAccessible = urlObtained && verifyUrl ? await testUrlAccessible(url) : urlObtained

    return {
      quality,
      declared,
      urlObtained,
      urlAccessible,
      actualQuality: result?.type || quality,
      url,
      duration: Date.now() - start,
    }
  } catch (err: any) {
    return {
      quality,
      declared,
      urlObtained: false,
      urlAccessible: false,
      error: err?.message || String(err),
      duration: Date.now() - start,
    }
  }
}
