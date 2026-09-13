import musicSdk from '@/utils/musicSdk'
import { assertApiSupport } from '@/utils/tools'
import { toNewMusicInfo } from '@/utils'
import { QUALITY_RANK } from '@/core/music/utils'
import { fetchAndApplyDetailedQuality } from '@/utils/musicSdk/wy/musicDetail'
import { testSingleQuality } from './testQuality'
import type { PlatformTestResult, QualityTestResult } from './types'

export const PLATFORM_SOURCES: { id: LX.OnlineSource; name: string }[] = [
  { id: 'kw', name: '酷我音乐' },
  { id: 'kg', name: '酷狗音乐' },
  { id: 'tx', name: 'QQ音乐' },
  { id: 'wy', name: '网易音乐' },
  { id: 'mg', name: '咪咕音乐' },
  { id: 'git', name: 'Gitcode' },
]

/**
 * 在当前激活的音源下测试单个平台
 */
export const testSinglePlatform = async (
  source: LX.OnlineSource,
  sourceName: string,
  songName: string,
  singer: string,
  options: {
    testAllQualities?: boolean
    onQualityProgress?: (q: LX.Quality) => void
    shouldStop?: () => boolean
  } = {}
): Promise<PlatformTestResult> => {
  const { testAllQualities = true, onQualityProgress, shouldStop } = options
  const base = { source, sourceName }

  // 1. 检查平台是否支持
  if (!assertApiSupport(source)) {
    return { ...base, supported: false, searched: false, qualities: [], overallAvailable: false, error: 'API not supported' }
  }
  if (!musicSdk[source]?.musicSearch) {
    return { ...base, supported: false, searched: false, qualities: [], overallAvailable: false, error: 'No search module' }
  }

  // 2. 搜索歌曲
  let musicInfo: LX.Music.MusicInfoOnline | undefined
  try {
    const result: any = await musicSdk[source].musicSearch.search(
      `${songName} ${singer}`.trim(),
      1, 30, 0,
      { enableSerpApi: source === 'wy' }
    )
    const list = (result?.list || []).map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
    if (!list.length) {
      return { ...base, supported: true, searched: false, qualities: [], overallAvailable: false, error: 'No search result' }
    }
    // 优先同歌手匹配
    musicInfo = list.find(m => m.singer?.includes(singer)) || list[0]
  } catch (err: any) {
    return { ...base, supported: true, searched: false, qualities: [], overallAvailable: false, error: `Search failed: ${err?.message || err}` }
  }

  // 3. 网易云补全详情
  if (source === 'wy' && musicInfo && !musicInfo.meta._full) {
    try {
      musicInfo = await fetchAndApplyDetailedQuality(musicInfo)
    } catch {}
  }

  // 4. 确定测试音质列表
  const qualitiesToTest = testAllQualities
    ? [...QUALITY_RANK]
    : QUALITY_RANK.filter(q => musicInfo!.meta._qualitys[q])

  // 5. 逐个测试
  const qualities: QualityTestResult[] = []
  for (const q of qualitiesToTest) {
    if (shouldStop?.()) break
    onQualityProgress?.(q)
    qualities.push(await testSingleQuality(musicInfo, q))
    await new Promise(r => setTimeout(r, 150))  // 避免限流
  }

  // 6. 汇总
  const available = qualities.filter(q => q.urlAccessible)
  const bestQuality = available.length
    ? QUALITY_RANK.find(q => available.some(a => a.quality === q))
    : undefined

  return {
    ...base,
    supported: true,
    searched: true,
    musicInfo,
    qualities,
    bestQuality,
    overallAvailable: available.length > 0,
  }
}
