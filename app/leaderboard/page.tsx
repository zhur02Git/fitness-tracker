'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type LeaderboardEntry = {
  user_id: string
  display_name: string
  total: number
  this_week: number
  this_month: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [tab, setTab] = useState<'this_week' | 'this_month' | 'total'>('this_week')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      // 获取所有用户的训练次数
      const { data: workouts } = await supabase
        .from('workouts')
        .select('user_id, created_at')

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')

      if (!workouts || !profiles) { setLoading(false); return }

      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      // 统计每个用户
      const statsMap: Record<string, { total: number; this_week: number; this_month: number }> = {}

      for (const w of workouts) {
        if (!statsMap[w.user_id]) {
          statsMap[w.user_id] = { total: 0, this_week: 0, this_month: 0 }
        }
        statsMap[w.user_id].total++

        const d = new Date(w.created_at)
        if (d >= weekStart) statsMap[w.user_id].this_week++
        if (d >= monthStart) statsMap[w.user_id].this_month++
      }

      const result: LeaderboardEntry[] = profiles.map(p => ({
        user_id: p.id,
        display_name: p.display_name,
        total: statsMap[p.id]?.total || 0,
        this_week: statsMap[p.id]?.this_week || 0,
        this_month: statsMap[p.id]?.this_month || 0,
      }))

      setEntries(result)
      setLoading(false)
    }
    fetch()
  }, [])

  const sorted = [...entries].sort((a, b) => b[tab] - a[tab])

  const tabLabels = {
    this_week: '本周',
    this_month: '本月',
    total: '总计',
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">🏆 排行榜</h1>
      </div>

      {/* Tab 切换 */}
      <div className="px-4 pt-5">
        <div className="bg-gray-900 rounded-2xl p-1 flex gap-1">
          {(['this_week', 'this_month', 'total'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-yellow-500 text-gray-950'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">还没有人训练过</p>
          </div>
        ) : (
          sorted.map((entry, index) => {
            const isMe = entry.user_id === currentUserId
            const count = entry[tab]

            return (
              <div
                key={entry.user_id}
                className={`rounded-2xl px-4 py-4 flex items-center gap-4 transition-all ${
                  isMe
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-gray-900'
                }`}
              >
                {/* 排名 */}
                <div className="w-8 text-center">
                  {index < 3 ? (
                    <span className="text-xl">{medals[index]}</span>
                  ) : (
                    <span className="text-gray-500 text-sm font-bold">{index + 1}</span>
                  )}
                </div>

                {/* 头像 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  isMe ? 'bg-yellow-500 text-gray-950' : 'bg-gray-700 text-white'
                }`}>
                  {entry.display_name.charAt(0).toUpperCase()}
                </div>

                {/* 名字 */}
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {entry.display_name}
                    {isMe && <span className="ml-2 text-xs text-yellow-400">（我）</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tabLabels[tab]}训练 {count} 次
                  </p>
                </div>

                {/* 次数 */}
                <div className="text-right">
                  <p className={`text-xl font-bold ${count > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {count}
                  </p>
                  <p className="text-xs text-gray-500">次</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}