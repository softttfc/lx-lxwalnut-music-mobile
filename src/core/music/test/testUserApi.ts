export const testAllUserApis = async (songName, singer, options) => {
  const originalApiId = settingState.setting['common.apiSource']
  const results = []
  
  // 遍历所有用户音源
  for (const api of userApiState.list) {
    // 激活该音源
    await setUserApi(api.id)
    // 等待初始化完成
    await waitForApiReady()
    // 测试各平台
    const result = await testSourceInCurrentApi(songName, singer)
    results.push({ api, ...result })
  }
  
  // 恢复原音源
  setApiSource(originalApiId)
  return results
}
