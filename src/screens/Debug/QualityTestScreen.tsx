import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native'
import {
  batchTestAllUserApis,
  PLATFORM_SOURCES,
  type BatchTestResult,
  type ApiTestResult,
  type PlatformTestResult,
  type TestProgress,
} from '@/core/music/test'
import { QUALITY_RANK } from '@/core/music/utils'

export default function QualityTestScreen() {
  const [songName, setSongName] = useState('')
  const [singer, setSinger] = useState('')
  const [testAllQualities, setTestAllQualities] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<TestProgress | null>(null)
  const [results, setResults] = useState<ApiTestResult[]>([])
  const [summary, setSummary] = useState<BatchTestResult['summary'] | null>(null)
  const [expandedApi, setExpandedApi] = useState<string | null>(null)
  const stopRef = useRef(false)

  const startTest = useCallback(async () => {
    if (!songName.trim()) {
      Alert.alert('提示', '请输入歌曲名')
      return
    }
    stopRef.current = false
    setRunning(true)
    setResults([])
    setSummary(null)
    setExpandedApi(null)

    try {
      const final = await batchTestAllUserApis(songName.trim(), singer.trim(), {
        testAllQualities,
        onProgress: (p) => setProgress(p),
        onApiComplete: (r) => setResults(prev => [...prev, r]),
        shouldStop: () => stopRef.current,
      })
      setSummary(final.summary)
    } catch (err: any) {
      Alert.alert('测试失败', err?.message || String(err))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }, [songName, singer, testAllQualities])

  const stopTest = () => { stopRef.current = true }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>音质与平台可用性测试</Text>

        <TextInput
          style={styles.input}
          placeholder="歌曲名（必填）"
          value={songName}
          onChangeText={setSongName}
          editable={!running}
        />
        <TextInput
          style={styles.input}
          placeholder="歌手（选填，用于匹配）"
          value={singer}
          onChangeText={setSinger}
          editable={!running}
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setTestAllQualities(v => !v)}
          disabled={running}
        >
          <View style={[styles.checkbox, testAllQualities && styles.checkboxChecked]}>
            {testAllQualities && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>测试所有音质（含未声明的）</Text>
        </TouchableOpacity>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, running && styles.btnDisabled]}
            onPress={startTest}
            disabled={running}
          >
            <Text style={styles.btnText}>{running ? '测试中...' : '开始测试'}</Text>
          </TouchableOpacity>
          {running && (
            <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopTest}>
              <Text style={styles.btnText}>停止</Text>
            </TouchableOpacity>
          )}
        </View>

        {progress && (
          <View style={styles.progressBox}>
            <ActivityIndicator size="small" />
            <Text style={styles.progressText}>
              {progress.phase === 'activating' && `激活音源: ${progress.currentApi}`}
              {progress.phase === 'testing' && `测试: ${progress.currentPlatform || ''} ${progress.currentQuality || ''}`}
              {progress.phase === 'destroying' && `清理: ${progress.currentApi}`}
              {progress.phase === 'done' && '完成'}
              {' '}({progress.completedApis}/{progress.totalApis})
            </Text>
          </View>
        )}

        {summary && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>测试汇总</Text>
            <Text style={styles.summaryText}>
              可用音源: {summary.availableApis}/{summary.totalApis}{'\n'}
              可用平台: {summary.availablePlatforms}/{summary.totalPlatforms}{'\n'}
              可用音质: {summary.availableQualities}/{summary.totalQualities}
            </Text>
          </View>
        )}

        {results.map(api => (
          <ApiResultCard
            key={api.apiId}
            api={api}
            expanded={expandedApi === api.apiId}
            onToggle={() => setExpandedApi(expandedApi === api.apiId ? null : api.apiId)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function ApiResultCard({ api, expanded, onToggle }: {
  api: ApiTestResult
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.apiName}>
            {api.overallAvailable ? '✅ ' : '❌ '}{api.apiName}
          </Text>
          <Text style={styles.apiMeta}>
            {api.apiVersion ? `v${api.apiVersion} ` : ''}
            {api.apiAuthor ? `by ${api.apiAuthor} ` : ''}
            · {api.totalDuration}ms
          </Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {api.error && (
        <Text style={styles.errorText}>错误: {api.error}</Text>
      )}

      {expanded && api.platforms.map(p => (
        <PlatformRow key={p.source} platform={p} />
      ))}
    </View>
  )
}

function PlatformRow({ platform }: { platform: PlatformTestResult }) {
  const [expanded, setExpanded] = useState(false)
  const availableCount = platform.qualities.filter(q => q.urlAccessible).length

  return (
    <View style={styles.platformRow}>
      <TouchableOpacity
        style={styles.platformHeader}
        onPress={() => setExpanded(v => !v)}
      >
        <Text style={styles.platformName}>
          {platform.overallAvailable ? '✅ ' : '❌ '}{platform.sourceName}
        </Text>
        <Text style={styles.platformMeta}>
          {platform.error
            ? platform.error
            : `${availableCount}/${platform.qualities.length} 音质可用`}
        </Text>
      </TouchableOpacity>

      {expanded && platform.qualities.length > 0 && (
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.headerCell]}>音质</Text>
            <Text style={[styles.cell, styles.headerCell]}>声明</Text>
            <Text style={[styles.cell, styles.headerCell]}>获取</Text>
            <Text style={[styles.cell, styles.headerCell]}>可访问</Text>
            <Text style={[styles.cell, styles.headerCell]}>实际</Text>
            <Text style={[styles.cell, styles.headerCell]}>耗时</Text>
          </View>
          {platform.qualities.map(q => (
            <View key={q.quality} style={styles.tableRow}>
              <Text style={styles.cell}>{q.quality}</Text>
              <Text style={styles.cell}>{q.declared ? '✅' : '—'}</Text>
              <Text style={styles.cell}>{q.urlObtained ? '✅' : '❌'}</Text>
              <Text style={styles.cell}>{q.urlAccessible ? '✅' : '❌'}</Text>
              <Text style={styles.cell}>{q.actualQuality || '—'}</Text>
              <Text style={styles.cell}>{q.duration}ms</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#222' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 10, backgroundColor: '#fff', fontSize: 15,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 20, height: 20, borderWidth: 1.5, borderColor: '#999',
    borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: '#333' },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btn: {
    flex: 1, backgroundColor: '#007AFF', padding: 14,
    borderRadius: 8, alignItems: 'center',
  },
  btnStop: { backgroundColor: '#FF3B30', flex: 0.5 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  progressBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12,
  },
  progressText: { color: '#666', flex: 1, fontSize: 13 },
  summaryBox: {
    backgroundColor: '#e6f2ff', padding: 14, borderRadius: 8, marginBottom: 16,
  },
  summaryTitle: { fontWeight: '700', marginBottom: 8, color: '#0055aa' },
  summaryText: { color: '#0055aa', lineHeight: 22, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, marginBottom: 10, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  apiName: { fontSize: 15, fontWeight: '600', color: '#222' },
  apiMeta: { fontSize: 12, color: '#999', marginTop: 4 },
  expandIcon: { fontSize: 14, color: '#999', marginLeft: 8 },
  errorText: { color: '#FF3B30', fontSize: 12, paddingHorizontal: 14, paddingBottom: 10 },
  platformRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingHorizontal: 14 },
  platformHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  platformName: { fontSize: 14, fontWeight: '500' },
  platformMeta: { fontSize: 12, color: '#666' },
  table: { paddingBottom: 10 },
  tableRow: { flexDirection: 'row', paddingVertical: 4 },
  cell: { flex: 1, fontSize: 11, textAlign: 'center', color: '#333' },
  headerCell: { fontWeight: '600', color: '#666' },
})
