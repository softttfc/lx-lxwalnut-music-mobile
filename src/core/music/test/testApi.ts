import { onScriptAction } from '@/utils/nativeModules/userApi'
import type { ApiTestResult, PlatformTestResult, TestProgress } from './types'
import { testSinglePlatform, PLATFORM_SOURCES } from './testPlatform'

/**
 * 等待当前音源初始化完成
 * 通过监听 onScriptAction 的 init 事件判断
 */
export const waitForApiReady = (timeout = 20000): Promise<void> => {
  return new Promise((resolve, reject) => {
    let removeListener: (() => void) | null = null
    const timer = setTimeout(() => {
      removeListener?.()
      reject(new Error('API init timeout'))
    }, timeout)

    removeListener = onScriptAction((event) => {
      if (event.action === 'init') {
        clearTimeout(timer)
        removeListener?.()
        // 检查 init 结果
        const data = event.data as any
        if (data?.status === false) {
          reject(new Error(data.errorMessage || 'API init failed'))
        } else {
          resolve()
        }
      }
    })
  })
}

/**
 * 在当前已激活的音源下，测试所有平台
 */
export const testPlatformsInCurrentApi = async (
  songName: string,
  singer: string,
  options: {
    testAllQualities?: boolean
    platforms?: LX.OnlineSource[]
    onProgress?: (p: TestProgress) => void
    shouldStop?: () => boolean
  } = {}
): Promise<PlatformTestResult[]> => {
  const {
    testAllQualities = true,
    platforms = PLATFORM_SOURCES.map(p => p.id),
    onProgress,
    shouldStop,
  } = options

  const results: PlatformTestResult[] = []
  const targets = PLATFORM_SOURCES.filter(p => platforms.includes(p.id))

  for (const platform of targets) {
    if (shouldStop?.()) break
    onProgress?.({
      phase: 'testing',
      currentPlatform: platform.id,
      completedApis: 0,
      totalApis: 0,
    })

    const result = await testSinglePlatform(
      platform.id,
      platform.name,
      songName,
      singer,
      {
        testAllQualities,
        onQualityProgress: (q) => onProgress?.({
          phase: 'testing',
          currentPlatform: platform.id,
          currentQuality: q,
          completedApis: 0,
          totalApis: 0,
        }),
        shouldStop,
      }
    )
    results.push(result)
  }

  return results
}
