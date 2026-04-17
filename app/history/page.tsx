'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type StrengthSet = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number
}

type CardioSession = {
  exercise_type: string
  duration_minutes: number
  distance_km: number | null
}

type Workout = {
  id: string
  date: string
  notes: string | null
  created_at: string
  strength_sets: StrengthSet[]
  cardio_sessions: CardioSession[]
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, date, notes, created_at,
          strength_sets ( exercise_name, sets, reps, weight_kg ),
          cardio_sessions ( exercise_type, duration_minutes, distance_km )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        setWorkouts(data as Workout[])
      }
      setLoading(false)
    }

    fetchHistory()
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">📅 训练历史</h1>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400 text-sm">加载中...</div>
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">🏋️</div>
            <p className="text-gray-400 text-sm">还没有训练记录</p>
            <p className="text-gray-600 text-xs mt-1">去记录你的第一次训练吧！</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              开始训练
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <div key={workout.id} className="bg-gray-900 rounded-2xl p-4">
                {/* 时间头部 */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white">
                    {formatDate(workout.created_at)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(workout.created_at)}
                  </span>
                </div>

                {/* 力量训练 */}
                {workout.strength_sets.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">🏋️</span>
                      <span className="text-xs text-gray-400 font-medium">力量训练</span>
                    </div>
                    <div className="space-y-1.5">
                      {workout.strength_sets.map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                          <span className="text-sm font-medium">{s.exercise_name}</span>
                          <span className="text-xs text-gray-400">
                            {s.sets}组 × {s.reps}次 · {s.weight_kg}kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 有氧训练 */}
                {workout.cardio_sessions.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">🏃</span>
                      <span className="text-xs text-gray-400 font-medium">有氧运动</span>
                    </div>
                    <div className="space-y-1.5">
                      {workout.cardio_sessions.map((c, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                          <span className="text-sm font-medium">{c.exercise_type}</span>
                          <span className="text-xs text-gray-400">
                            {c.duration_minutes}分钟
                            {c.distance_km ? ` · ${c.distance_km}km` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {workout.notes && (
                  <div className="mt-2 px-3 py-2 bg-gray-800/50 rounded-xl">
                    <p className="text-xs text-gray-400">💬 {workout.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}