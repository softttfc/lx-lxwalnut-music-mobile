import userApiState from '@/store/userApi/state'
import settingState from '@/store/setting/state'
import { setUserApi, destroyUserApi } from '@/core/apiSource/userApi'
import { setApiSource } from '@/core/apiSource'
import { testPlatformsInCurrentApi, waitForApiReady } from './testApi'
import type { BatchTestResult, ApiTestResult, TestProgress } from './types'

export * from './types'
export { PLATFORM_SOURCES } from './testPlatform'
export { testUrlAccessible } from './testQuality'

/**
 * 批量测试所有已导入的用户音源
 */
export const batchTestAllUserApis = async (
  songName: string,
  singer: string,
  options: {
    testAllQualities?: boolean
    platforms?: LX.OnlineSource[]
    onApiComplete?: (r: ApiTestResult) => void
    onProgress?: (p: TestProgress) => void
    shouldStop?: () => boolean
    /** 每个音源的初始化超时（ms） */
    apiInitTimeout?: number
  } = {}
): Promise<BatchTestResult> => {
  const {
    testAllQualities = true,
    platforms,
    onApiComplete,
    onProgress,
    shouldStop,
    apiInitTimeout = 20000,
  } = options

  const originalApiId = settingState.setting['common.apiSource']
  const apiList = [...userApiState.list]
  const results: ApiTestResult[] = []

  for (let i = 0; i < apiList.length; i++) {
    if (shouldStop?.()) break
    const api = apiList[i]
    const startTime = Date.now()

    onProgress?.({
      phase: 'activating',
      currentApi: api.id,
      completedApis: i,
      totalApis: apiList.length,
    })

    let platforms_result: ApiTestResult['platforms'] = []
    let error: string | undefined

    try {
      // 1. 激活音源
      await setUserApi(api.id)

      // 2. 等待就绪
      await waitForApiReady(apiInitTimeout)

      // 3. 测试各平台
      platforms_result = await testPlatformsInCurrentApi(songName, singer, {
        testAllQualities,
        platforms,
        onProgress,
        shouldStop,
      })
    } catch (err: any) {
      error = err?.message || String(err)
    } finally {
      // 4. 销毁当前音源
      onProgress?.({
        phase: 'destroying',
        currentApi: api.id,
        completedApis: i + 1,
        totalApis: apiList.length,
      })
      try { destroyUserApi() } catch {}
    }

    const apiResult: ApiTestResult = {
      apiId: api.id,
      apiName: api.name,
      apiVersion: api.version,
      apiAuthor: api.author,
      platforms: platforms_result,
      overallAvailable: platforms_result.some(p => p.overallAvailable),
      error,
      totalDuration: Date.now() - startTime,
    }
    results.push(apiResult)
    onApiComplete?.(apiResult)

    // 短暂延迟，确保原生沙箱完全清理
    await new Promise(r => setTimeout(r, 500))
  }

  // 5. 恢复原音源
  try {
    if (originalApiId && originalApiId !== '') {
      await setApiSource(originalApiId)
    }
  } catch (err) {
    console.warn('Restore original api failed:', err)
  }

  onProgress?.({
    phase: 'done',
    completedApis: apiList.length,
    totalApis: apiList.length,
  })

  // 6. 汇总
  const allPlatforms = results.flatMap(r => r.platforms)
  const allQualities = allPlatforms.flatMap(p => p.qualities)

  return {
    songName,
    singer,
    timestamp: Date.now(),
    apis: results,
    summary: {
      totalApis: results.length,
      availableApis: results.filter(r => r.overallAvailable).length,
      totalPlatforms: allPlatforms.length,
      availablePlatforms: allPlatforms.filter(p => p.overallAvailable).length,
      totalQualities: allQualities.length,
      availableQualities: allQualities.filter(q => q.urlAccessible).length,
    },
  }
}
