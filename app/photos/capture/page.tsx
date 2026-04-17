'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Suspense } from 'react'

function CaptureContent() {
  const [step, setStep] = useState<'guide' | 'camera' | 'preview' | 'saving'>('guide')
  const [part, setPart] = useState<'face' | 'waist'>('face')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [imageBase64, setImageBase64] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const partFromUrl = searchParams.get('part') as 'face' | 'waist' | null
  const currentPart = partFromUrl || part

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setError('')
    setCameraReady(false)
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      setStep('camera')
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(console.error)
        }
      }, 100)
    } catch {
      setError('无法访问摄像头，请检查浏览器权限，或改用相册上传')
    }
  }

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    await startCamera(newMode)
  }

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 前置摄像头镜像翻转，后置不翻转
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setImageBase64(dataUrl.split(',')[1])
    setImagePreview(dataUrl)
    stopCamera()
    setStep('preview')
  }, [facingMode])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImageBase64(dataUrl.split(',')[1])
      setImagePreview(dataUrl)
      setStep('preview')
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSave = async () => {
    setStep('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const fileName = `${user.id}/${currentPart}_${Date.now()}.jpg`
    const blob = await fetch(`data:image/jpeg;base64,${imageBase64}`).then(r => r.blob())

    const { error: uploadError } = await supabase.storage
      .from('body-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg' })

    if (uploadError) {
      setError('上传失败：' + uploadError.message)
      setStep('preview')
      return
    }

    const { error: dbError } = await supabase
      .from('body_photos')
      .insert({
        user_id: user.id,
        part: currentPart,
        photo_url: fileName,
        ai_quality_pass: true,
        ai_quality_note: ''
      })

    if (dbError) {
      setError('保存失败：' + dbError.message)
      setStep('preview')
      return
    }

    router.push('/photos')
  }

  const guides = {
    face: {
      emoji: '🤳',
      title: '拍摄脸部照片',
      tips: [
        '💡 在自然光或明亮室内光下拍摄',
        '📐 保持正面或¾侧面角度',
        '📏 脸部占画面60%以上',
        '😶 保持自然表情，不要遮挡脸部',
        '🚫 避免强烈背光或阴影',
      ],
      example: '站在窗户旁边，面向光源，手机举至眼睛高度拍摄'
    },
    waist: {
      emoji: '💪',
      title: '拍摄腰腹部照片',
      tips: [
        '💡 在明亮环境下拍摄，光线均匀',
        '📐 正面站立，身体居中',
        '👕 穿贴身衣物或露出腰腹部',
        '📏 腰腹部占画面主体',
        '🧍 自然站立，不要刻意收腹',
      ],
      example: '站在镜子前，手机放置腰部高度，正面自拍或请人帮拍'
    }
  }

  const guide = guides[currentPart]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => { stopCamera(); router.back() }} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">{guide.emoji} {guide.title}</h1>
      </div>

      {/* 引导页 */}
      {step === 'guide' && (
        <div className="px-4 py-6 space-y-6">
          {!partFromUrl && (
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-sm text-gray-400 mb-3">选择拍摄部位</p>
              <div className="grid grid-cols-2 gap-3">
                {(['face', 'waist'] as const).map(p => (
                  <button key={p} onClick={() => setPart(p)}
                    className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                      currentPart === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                    }`}>
                    {p === 'face' ? '🤳 脸部' : '💪 腰腹部'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white">📋 拍摄要求</h2>
            <div className="space-y-3">
              {guide.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5">{tip.split(' ')[0]}</span>
                  <p className="text-sm text-gray-300">{tip.split(' ').slice(1).join(' ')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-4">
            <p className="text-xs text-blue-400 mb-1">💡 拍摄示例</p>
            <p className="text-sm text-gray-300">{guide.example}</p>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button onClick={() => startCamera()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl py-4 text-base transition-colors">
            📸 开始拍照
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full bg-gray-900 hover:bg-gray-800 text-gray-300 font-medium rounded-2xl py-3 text-sm transition-colors">
            🖼️ 从相册选择
          </button>
        </div>
      )}

      {/* 摄像头画面 */}
      {step === 'camera' && (
        <div className="flex flex-col items-center px-4 py-6 space-y-5">
          <div className="relative w-full rounded-2xl overflow-hidden bg-black min-h-64">
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <p className="text-gray-400 text-sm animate-pulse">摄像头启动中...</p>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted
              onLoadedMetadata={() => { videoRef.current?.play(); setCameraReady(true) }}
              onCanPlay={() => { videoRef.current?.play(); setCameraReady(true) }}
              className="w-full"
              style={{
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                display: cameraReady ? 'block' : 'none'
              }}
            />
            {cameraReady && (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`border-2 border-blue-400 border-dashed rounded-2xl opacity-70 ${
                    currentPart === 'face' ? 'w-48 h-60' : 'w-56 h-72'
                  }`} />
                </div>
                <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/70">
                  {currentPart === 'face' ? '将脸部对准框内' : '将腰腹部对准框内'}
                </p>

                {/* 切换摄像头按钮 */}
                <button
                  onClick={switchCamera}
                  className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
                >
                  🔄
                </button>

                {/* 当前摄像头指示 */}
                <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2.5 py-1.5 rounded-full">
                  {facingMode === 'user' ? '前置' : '后置'}
                </div>
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* 底部控制栏 */}
          <div className="flex items-center justify-center gap-8 w-full">
            <button onClick={() => { stopCamera(); setStep('guide') }}
              className="text-gray-400 text-sm hover:text-white transition-colors w-16 text-center">
              取消
            </button>

            {/* 拍照按钮 */}
            <button onClick={takePhoto} disabled={!cameraReady}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-40">
              <div className="w-16 h-16 bg-white border-4 border-gray-300 rounded-full" />
            </button>

            {/* 切换摄像头（底部也放一个，手机更方便点） */}
            <button onClick={switchCamera} disabled={!cameraReady}
              className="text-gray-400 hover:text-white w-16 text-center text-2xl disabled:opacity-40 transition-colors">
              🔄
            </button>
          </div>
        </div>
      )}

      {/* 预览确认 */}
      {step === 'preview' && (
        <div className="px-4 py-6 space-y-5">
          <div className="relative">
            <img src={imagePreview} alt="预览" className="w-full rounded-2xl object-cover max-h-96" />
            <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-medium">
              {currentPart === 'face' ? '🤳 脸部' : '💪 腰腹部'}
            </div>
          </div>

          <p className="text-center text-gray-400 text-sm">照片看起来满意吗？</p>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button onClick={handleSave}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl py-4 text-base transition-colors">
            ✅ 保存这张照片
          </button>

          <button onClick={() => setStep('guide')}
            className="w-full bg-gray-900 hover:bg-gray-800 text-gray-300 font-medium rounded-2xl py-3 text-sm transition-colors">
            🔄 重新拍摄
          </button>
        </div>
      )}

      {/* 保存中 */}
      {step === 'saving' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <div className="text-4xl animate-pulse">☁️</div>
          <p className="text-white font-semibold">正在保存照片...</p>
        </div>
      )}
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">加载中...</div>
    }>
      <CaptureContent />
    </Suspense>
  )
}