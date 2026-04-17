'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

type StrengthData = {
  date: string
  weight: number
  reps: number
  sets: number
}

type VolumeData = {
  date: string
  totalSets: number
  totalVolume: number
}

export default function StatsPage() {
  const [exercises, setExercises] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [strengthData, setStrengthData] = useState<StrengthData[]>([])
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [tab, setTab] = useState<'strength' | 'volume'>('strength')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 获取所有训练过的动作
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)

      if (!workouts || workouts.length === 0) { setLoading(false); return }

      const workoutIds = workouts.map(w => w.id)

      const { data: sets } = await supabase
        .from('strength_sets')
        .select('exercise_name')
        .in('workout_id', workoutIds)

      if (sets) {
        const unique = [...new Set(sets.map(s => s.exercise_name))]
        setExercises(unique)
        if (unique.length > 0) setSelectedExercise(unique[0])
      }

      // 获取总训练量数据
      await fetchVolumeData(user.id)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedExercise) fetchStrengthData()
  }, [selectedExercise])

  const fetchStrengthData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!workouts) return

    const workoutIds = workouts.map(w => w.id)
    const workoutDateMap = Object.fromEntries(workouts.map(w => [w.id, w.created_at]))

    const { data: sets } = await supabase
      .from('strength_sets')
      .select('workout_id, weight_kg, reps, sets')
      .in('workout_id', workoutIds)
      .eq('exercise_name', selectedExercise)

    if (!sets) return

    // 按 workout 分组，取每次训练的最大重量
    const grouped: Record<string, StrengthData> = {}
    for (const s of sets) {
      const date = new Date(workoutDateMap[s.workout_id]).toLocaleDateString('zh-CN', {
        month: 'short', day: 'numeric'
      })
      if (!grouped[s.workout_id] || s.weight_kg > grouped[s.workout_id].weight) {
        grouped[s.workout_id] = {
          date,
          weight: s.weight_kg || 0,
          reps: s.reps,
          sets: s.sets
        }
      }
    }

    setStrengthData(Object.values(grouped))
  }

  const fetchVolumeData = async (userId: string) => {
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!workouts) return

    const workoutIds = workouts.map(w => w.id)
    const workoutDateMap = Object.fromEntries(workouts.map(w => [w.id, w.created_at]))

    const { data: sets } = await supabase
      .from('strength_sets')
      .select('workout_id, sets, reps, weight_kg')
      .in('workout_id', workoutIds)

    if (!sets) return

    const volumeMap: Record<string, VolumeData> = {}
    for (const s of sets) {
      const wid = s.workout_id
      const date = new Date(workoutDateMap[wid]).toLocaleDateString('zh-CN', {
        month: 'short', day: 'numeric'
      })
      if (!volumeMap[wid]) {
        volumeMap[wid] = { date, totalSets: 0, totalVolume: 0 }
      }
      volumeMap[wid].totalSets += s.sets
      volumeMap[wid].totalVolume += (s.sets * s.reps * (s.weight_kg || 0))
    }

    setVolumeData(Object.values(volumeMap))
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
          <p className="text-gray-400 mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }} className="font-medium">
              {p.name}: {p.value}{p.name === '最大重量' ? 'kg' : p.name === '总重量' ? 'kg' : '组'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-8">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">📊 训练数据</h1>
      </div>

      {/* Tab */}
      <div className="px-4 pt-4">
        <div className="bg-gray-900 rounded-2xl p-1 flex gap-1">
          <button onClick={() => setTab('strength')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'strength' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            💪 动作进步
          </button>
          <button onClick={() => setTab('volume')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'volume' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            📈 训练总量
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-5xl">📊</div>
            <p className="text-gray-400 text-sm">还没有训练数据</p>
            <button onClick={() => router.push('/workout/strength')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium">
              开始训练
            </button>
          </div>
        ) : (
          <>
            {/* 动作进步图 */}
            {tab === 'strength' && (
              <div className="space-y-4">
                {/* 动作选择 */}
                <div className="bg-gray-900 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-3">选择动作</p>
                  <div className="flex flex-wrap gap-2">
                    {exercises.map(ex => (
                      <button key={ex} onClick={() => setSelectedExercise(ex)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          selectedExercise === ex
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 重量折线图 */}
                {strengthData.length > 0 ? (
                  <div className="bg-gray-900 rounded-2xl p-4">
                    <h3 className="font-semibold text-sm mb-1">{selectedExercise} — 重量进步</h3>
                    <p className="text-xs text-gray-400 mb-4">每次训练最大重量 (kg)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={strengthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone" dataKey="weight" name="最大重量"
                          stroke="#3B82F6" strokeWidth={2}
                          dot={{ fill: '#3B82F6', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* 统计摘要 */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400">最高重量</p>
                        <p className="text-lg font-bold text-blue-400 mt-1">
                          {Math.max(...strengthData.map(d => d.weight))}kg
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400">训练次数</p>
                        <p className="text-lg font-bold text-green-400 mt-1">
                          {strengthData.length}次
                        </p>
                      </div>
                      <div className="bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400">重量提升</p>
                        <p className="text-lg font-bold text-yellow-400 mt-1">
                          {strengthData.length > 1
                            ? `+${(strengthData[strengthData.length - 1].weight - strengthData[0].weight).toFixed(1)}kg`
                            : '–'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-2xl p-8 text-center">
                    <p className="text-gray-400 text-sm">暂无 {selectedExercise} 的数据</p>
                  </div>
                )}
              </div>
            )}

            {/* 训练总量图 */}
            {tab === 'volume' && volumeData.length > 0 && (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-1">每次训练总组数</h3>
                  <p className="text-xs text-gray-400 mb-4">每次训练完成的总组数</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={volumeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="totalSets" name="总组数" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-900 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-1">每次训练总重量</h3>
                  <p className="text-xs text-gray-400 mb-4">组数 × 次数 × 重量 (kg)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={volumeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="totalVolume" name="总重量" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 总量统计 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-2xl p-4 text-center">
                    <p className="text-xs text-gray-400">总训练次数</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{volumeData.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">次</p>
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-4 text-center">
                    <p className="text-xs text-gray-400">累计总重量</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">
                      {(volumeData.reduce((sum, d) => sum + d.totalVolume, 0) / 1000).toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">吨</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}