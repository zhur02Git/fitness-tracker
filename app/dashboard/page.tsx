'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type RecentWorkout = {
  id: string
  created_at: string
  strength_sets: { exercise_name: string }[]
  cardio_sessions: { exercise_type: string }[]
}

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState('')
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      // 获取最近3条记录
      const { data } = await supabase
        .from('workouts')
        .select(`
          id, created_at,
          strength_sets ( exercise_name ),
          cardio_sessions ( exercise_type )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) setRecentWorkouts(data as RecentWorkout[])

      // 获取总训练次数
      const { count } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setTotalWorkouts(count || 0)
      setLoading(false)
    }
    init()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = Math.floor((new Date().getTime() - d.getTime()) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const getWorkoutSummary = (w: RecentWorkout) => {
    const items = [
      ...w.strength_sets.map(s => s.exercise_name),
      ...w.cardio_sessions.map(c => c.exercise_type),
    ]
    if (items.length === 0) return '空记录'
    if (items.length <= 2) return items.join('、')
    return `${items.slice(0, 2).join('、')} 等${items.length}项`
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm">你好 👋</p>
            <h1 className="text-2xl font-bold mt-1">准备好训练了吗？</h1>
            <p className="text-xs text-gray-500 mt-1">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-1"
          >
            退出
          </button>
        </div>

        {/* 统计 */}
        <div className="mt-5 bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="text-2xl">🔥</div>
          <div>
            <p className="text-xs text-gray-400">累计训练</p>
            <p className="text-lg font-bold">
              {loading ? '–' : totalWorkouts} <span className="text-sm font-normal text-gray-400">次</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* 开始训练 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">今天练什么</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/workout/strength')}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl p-5 text-left transition-all"
            >
              <div className="text-3xl mb-3">🏋️</div>
              <div className="font-semibold text-sm">力量训练</div>
              <div className="text-xs text-blue-200 mt-1">组数 · 重量 · 次数</div>
            </button>

            <button
              onClick={() => router.push('/workout/cardio')}
              className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-2xl p-5 text-left transition-all"
            >
              <div className="text-3xl mb-3">🏃</div>
              <div className="font-semibold text-sm">有氧运动</div>
              <div className="text-xs text-orange-100 mt-1">时长 · 距离</div>
            </button>
          </div>
        </div>

        {/* 查看历史 */}
        <button
          onClick={() => router.push('/history')}
          className="w-full bg-gray-900 hover:bg-gray-800 active:scale-95 rounded-2xl p-4 flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div className="text-left">
              <div className="font-semibold text-sm">训练历史</div>
              <div className="text-xs text-gray-400 mt-0.5">查看所有记录</div>
            </div>
          </div>
          <span className="text-gray-500 text-lg">→</span>
        </button>

        {/* 最近记录 */}
        {!loading && recentWorkouts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">最近训练</h2>
            <div className="space-y-2">
              {recentWorkouts.map((w) => (
                <div key={w.id} className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{getWorkoutSummary(w)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(w.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    {w.strength_sets.length > 0 && <span className="text-base">🏋️</span>}
                    {w.cardio_sessions.length > 0 && <span className="text-base">🏃</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}