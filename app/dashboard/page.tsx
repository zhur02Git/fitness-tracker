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

type StrengthSet = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number | null
}

type WorkoutWithSets = {
  id: string
  date: string
  created_at: string
  strength_sets: StrengthSet[]
}

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState('')
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

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

  const handleExport = async () => {
    setIsExporting(true)
    setExportDone(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          date,
          created_at,
          strength_sets (
            exercise_name,
            sets,
            reps,
            weight_kg
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      if (error) {
        console.error('Supabase错误:', JSON.stringify(error))
        throw new Error('获取数据失败')
      }

      const typedWorkouts = (workouts || []) as WorkoutWithSets[]
      const strengthWorkouts = typedWorkouts.filter(w => w.strength_sets && w.strength_sets.length > 0)

      const sessions = strengthWorkouts.map(workout => {
        const date = workout.date || workout.created_at.split('T')[0]

        const exercises = workout.strength_sets.map(s => {
          const hasWeight = s.weight_kg !== null && s.weight_kg > 0
          return {
            name: s.exercise_name,
            sets: s.sets,
            reps_per_set: s.reps,
            total_reps: s.sets * s.reps,
            weight_kg: hasWeight ? s.weight_kg : null,
            total_volume_kg: hasWeight ? s.sets * s.reps * (s.weight_kg as number) : null,
          }
        })

        return { date, exercises }
      })

      const dates = sessions.map(s => s.date)
      const exportPayload = {
        export_info: {
          exported_at: new Date().toISOString(),
          user_email: userEmail,
          total_training_days: sessions.length,
          date_range: {
            earliest: dates[0] || '无记录',
            latest: dates[dates.length - 1] || '无记录'
          },
          how_to_use: '将此文件上传给Claude，问：请分析我的力量训练数据，给出进步趋势和改进建议'
        },
        training_sessions: sessions
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `训练数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportDone(true)
      setTimeout(() => setExportDone(false), 4000)
    } catch (err) {
      console.error(err)
      alert('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
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
          <button onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-1">
            退出
          </button>
        </div>

        <div className="mt-5 bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="text-2xl">🔥</div>
          <div>
            <p className="text-xs text-gray-400">累计训练</p>
            <p className="text-lg font-bold">
              {loading ? '–' : totalWorkouts}
              <span className="text-sm font-normal text-gray-400"> 次</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* 开始训练 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">今天练什么</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => router.push('/workout/strength')}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl p-5 text-left transition-all">
              <div className="text-3xl mb-3">🏋️</div>
              <div className="font-semibold text-sm">力量训练</div>
              <div className="text-xs text-blue-200 mt-1">组数 · 重量 · 次数</div>
            </button>
            <button onClick={() => router.push('/workout/cardio')}
              className="bg-orange-500 hover:bg-orange-400 active:scale-95 rounded-2xl p-5 text-left transition-all">
              <div className="text-3xl mb-3">🏃</div>
              <div className="font-semibold text-sm">有氧运动</div>
              <div className="text-xs text-orange-100 mt-1">时长 · 距离</div>
            </button>
          </div>
        </div>

        {/* 导出给Claude分析 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">AI 分析</h2>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full rounded-2xl p-4 flex items-center justify-between transition-all active:scale-95
              ${exportDone
                ? 'bg-green-800 border border-green-600'
                : 'bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 border border-purple-700'
              }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{exportDone ? '✅' : isExporting ? '⏳' : '📤'}</span>
              <div className="text-left">
                <div className="font-semibold text-sm">
                  {exportDone ? '导出成功！' : isExporting ? '正在导出...' : '导出数据给 Claude 分析'}
                </div>
                <div className="text-xs text-purple-300 mt-0.5">
                  {exportDone ? '上传JSON文件给Claude即可分析' : '下载全部训练记录 · JSON格式'}
                </div>
              </div>
            </div>
            {!isExporting && !exportDone && <span className="text-gray-400 text-lg">→</span>}
          </button>

          {exportDone && (
            <p className="text-xs text-green-400 mt-2 px-1">
              💡 把下载的 JSON 文件上传到 Claude，问：「请分析我的力量训练数据，给出进步趋势和建议」
            </p>
          )}
        </div>

        {/* 功能入口 */}
        <div className="space-y-3">
          {[
            { path: '/stats', emoji: '📊', title: '训练数据', sub: '进步曲线 · 总量统计' },
            { path: '/measurements', emoji: '📏', title: '身体数据', sub: '腰围 · 体重趋势' },
            { path: '/history', emoji: '📅', title: '训练历史', sub: '查看所有记录' },
            { path: '/leaderboard', emoji: '🏆', title: '排行榜', sub: '和大家比一比' },
            { path: '/photos', emoji: '📸', title: '身体变化记录', sub: 'AI 对比前后变化' },
          ].map(item => (
            <button key={item.path} onClick={() => router.push(item.path)}
              className="w-full bg-gray-900 hover:bg-gray-800 active:scale-95 rounded-2xl p-4 flex items-center justify-between transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
                </div>
              </div>
              <span className="text-gray-500 text-lg">→</span>
            </button>
          ))}
        </div>

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