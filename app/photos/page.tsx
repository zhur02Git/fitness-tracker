'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Photo = {
  id: string
  part: 'face' | 'waist'
  photo_url: string
  ai_quality_pass: boolean
  created_at: string
  signedUrl?: string
}

type CompareResult = {
  summary: string
  changes: string[]
  progress: 'positive' | 'neutral' | 'negative'
  encouragement: string
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [tab, setTab] = useState<'face' | 'waist'>('face')
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchPhotos()
  }, [tab])

  const fetchPhotos = async () => {
    setLoading(true)
    setCompareResult(null)
    setSelectedPhotos([])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('body_photos')
      .select('*')
      .eq('user_id', user.id)
      .eq('part', tab)
      .eq('ai_quality_pass', true)
      .order('created_at', { ascending: false })

    if (error || !data) { setLoading(false); return }

    // 获取签名 URL
    const withUrls = await Promise.all(data.map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from('body-photos')
        .createSignedUrl(photo.photo_url, 3600)
      return { ...photo, signedUrl: signed?.signedUrl || '' }
    }))

    setPhotos(withUrls)
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const handleCompare = async () => {
    if (photos.length < 2) return
    setComparing(true)
    setCompareResult(null)

    // 取最新和最旧的照片对比
    const latest = photos[0]
    const oldest = photos[photos.length - 1]

    try {
      // 把两张图片转成 base64
      const toBase64 = async (url: string) => {
        const res = await fetch(url)
        const blob = await res.blob()
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
      }

      const [latestBase64, oldestBase64] = await Promise.all([
        toBase64(latest.signedUrl!),
        toBase64(oldest.signedUrl!)
      ])

      const res = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: latestBase64,
          previousBase64: oldestBase64,
          part: tab,
          mode: 'compare'
        })
      })

      const result = await res.json()
      setCompareResult(result)
    } catch (e) {
      console.error('对比失败', e)
    }
    setComparing(false)
  }

  const progressColors = {
    positive: 'text-green-400',
    neutral: 'text-yellow-400',
    negative: 'text-red-400'
  }

  const progressEmoji = {
    positive: '📈',
    neutral: '➡️',
    negative: '📉'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
          <h1 className="text-lg font-bold">📸 身体变化记录</h1>
        </div>
        <button
          onClick={() => router.push(`/photos/capture?part=${tab}`)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + 拍照
        </button>
      </div>

      {/* Tab */}
      <div className="px-4 pt-4">
        <div className="bg-gray-900 rounded-2xl p-1 flex gap-1">
          <button
            onClick={() => setTab('face')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'face' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🤳 脸部
          </button>
          <button
            onClick={() => setTab('waist')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'waist' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            💪 腰腹部
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-5xl">📷</div>
            <p className="text-gray-400 text-sm">还没有{tab === 'face' ? '脸部' : '腰腹部'}照片</p>
            <button
              onClick={() => router.push(`/photos/capture?part=${tab}`)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              立即拍第一张
            </button>
          </div>
        ) : (
          <>
            {/* AI 对比按钮 */}
            {photos.length >= 2 && (
              <button
                onClick={handleCompare}
                disabled={comparing}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-2xl py-3.5 text-sm transition-colors"
              >
                {comparing ? '🤖 AI 分析中...' : '🤖 AI 对比最早 vs 最新变化'}
              </button>
            )}

            {/* AI 对比结果 */}
            {compareResult && (
              <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{progressEmoji[compareResult.progress]}</span>
                  <h3 className="font-bold text-white">AI 变化分析</h3>
                  <span className={`text-sm font-medium ml-auto ${progressColors[compareResult.progress]}`}>
                    {compareResult.progress === 'positive' ? '有进步！' :
                     compareResult.progress === 'neutral' ? '保持稳定' : '需要加油'}
                  </span>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed">{compareResult.summary}</p>

                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">具体变化</p>
                  {compareResult.changes.map((change, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-purple-400 text-xs mt-1">•</span>
                      <p className="text-sm text-gray-300">{change}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl px-4 py-3">
                  <p className="text-sm text-purple-300">💬 {compareResult.encouragement}</p>
                </div>

                {/* 对比图：最旧 vs 最新 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-2 text-center">最早</p>
                    <img
                      src={photos[photos.length - 1].signedUrl}
                      alt="最早"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {formatDate(photos[photos.length - 1].created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2 text-center">最新</p>
                    <img
                      src={photos[0].signedUrl}
                      alt="最新"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {formatDate(photos[0].created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 照片时间轴 */}
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                所有照片（{photos.length} 张）
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.signedUrl}
                      alt={`照片${i + 1}`}
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    {i === 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-lg">
                        最新
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {new Date(photo.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}