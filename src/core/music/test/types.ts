export interface QualityTestResult {
  quality: LX.Quality
  declared: boolean
  urlObtained: boolean
  urlAccessible: boolean
  actualQuality?: LX.Quality
  url?: string
  error?: string
  duration: number
}

export interface PlatformTestResult {
  source: LX.OnlineSource
  sourceName: string
  supported: boolean
  searched: boolean
  musicInfo?: LX.Music.MusicInfoOnline
  qualities: QualityTestResult[]
  bestQuality?: LX.Quality
  overallAvailable: boolean
  error?: string
}

export interface ApiTestResult {
  apiId: string
  apiName: string
  apiVersion?: string
  apiAuthor?: string
  platforms: PlatformTestResult[]
  overallAvailable: boolean
  error?: string
  totalDuration: number
}

export interface BatchTestResult {
  songName: string
  singer: string
  timestamp: number
  apis: ApiTestResult[]
  summary: {
    totalApis: number
    availableApis: number
    totalPlatforms: number
    availablePlatforms: number
    totalQualities: number
    availableQualities: number
  }
}

export interface TestProgress {
  phase: 'activating' | 'testing' | 'destroying' | 'done'
  currentApi?: string
  currentPlatform?: string
  currentQuality?: LX.Quality
  completedApis: number
  totalApis: number
}
