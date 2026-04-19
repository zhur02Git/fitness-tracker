'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

// ✅ 预设肌肉群配置（true=有重量，false=纯次数）
const MUSCLE_CONFIG: Record<string, Record<string, boolean>> = {
  '🫁 胸': { '卧推': true, '哑铃夹胸': true, '器械上推': true },
  '🦅 肩': { '飞鸟': true, '哑铃上推': true, '二头上推': true, '俯卧撑': false },
  '🦈 背': { '引体向上': false, '划船': true, '高位下拉': true, '单臂划船': true },
  '💪 手臂': { '哑铃后举': true, '哑铃锤举': true },
  '🦵 腿': { '深蹲': false, '哑铃深蹲': true, '罗马尼亚硬拉': true, '保加利亚蹲': true, '单腿起': false, '器械举腿': false },
}

// 所有预设动作的扁平集合，用于判断是否是自定义动作
const ALL_PRESET_EXERCISES = new Set(
  Object.values(MUSCLE_CONFIG).flatMap(group => Object.keys(group))
)

type ChartPoint = {
  date: string
  totalReps: number
  maxWeight?: number
}

type ExerciseData = Record<string, ChartPoint[]>

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}：{p.value}{p.name === '最大重量' ? ' kg' : ' 次'}
        </p>
      ))}
    </div>
  )
}

// ✅ 单个动作的趋势卡片（复用组件）
function ExerciseCard({
  exercise,
  data,
  hasWeight,
}: {
  exercise: string
  data: ChartPoint[]
  hasWeight: boolean
}) {
  const hasData = data.length > 0
  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{exercise}</h3>
        {hasData ? (
          <span className="text-xs text-gray-400">{data.length} 次记录</span>
        ) : (
          <span className="text-xs text-gray-600">暂无数据</span>
        )}
      </div>

      {!hasData ? (
        <div className="h-16 flex items-center justify-center">
          <p className="text-gray-600 text-xs">还没有训练记录</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6B7280' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} yAxisId="reps" orientation="left" />
              {hasWeight && (
                <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} yAxisId="weight" orientation="right" />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="reps"
                type="monotone"
                dataKey="totalReps"
                name="总次数"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3B82F6' }}
                activeDot={{ r: 5 }}
              />
              {hasWeight && (
                <Line
                  yAxisId="weight"
                  type="monotone"
                  dataKey="maxWeight"
                  name="最大重量"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10B981' }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* 最新数据摘要 */}
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-gray-400">最近总次数</p>
              <p className="font-bold text-blue-400 text-sm mt-0.5">
                {data[data.length - 1].totalReps} 次
              </p>
            </div>
            {hasWeight && data[data.length - 1].maxWeight != null && (
              <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-gray-400">最近最大重量</p>
                <p className="font-bold text-green-400 text-sm mt-0.5">
                  {data[data.length - 1].maxWeight} kg
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function StatsPage() {
  // Tab：预设肌肉群 + '✏️ 自定义' 
  const TABS = [...Object.keys(MUSCLE_CONFIG), '✏️ 自定义']
  const [selectedGroup, setSelectedGroup] = useState(TABS[0])
  const [exerciseData, setExerciseData] = useState<ExerciseData>({})
  const [customExercises, setCustomExercises] = useState<string[]>([]) // 用户自定义动作列表
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchAllData() }, [])

  const fetchAllData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (!workouts || workouts.length === 0) { setLoading(false); return }

    const workoutIds = workouts.map(w => w.id)
    const dateMap: Record<string, string> = {}
    for (const w of workouts) {
      dateMap[w.id] = new Date(w.created_at).toLocaleDateString('zh-CN', {
        month: 'short', day: 'numeric'
      })
    }

    const { data: sets } = await supabase
      .from('strength_sets')
      .select('workout_id, exercise_name, sets, reps, weight_kg')
      .in('workout_id', workoutIds)

    if (!sets) { setLoading(false); return }

    // 聚合：动作 -> 日期 -> { totalReps, maxWeight }
    const agg: Record<string, Record<string, { totalReps: number; maxWeight: number }>> = {}

    for (const s of sets) {
      const date = dateMap[s.workout_id]
      if (!date) continue
      const ex = s.exercise_name
      if (!agg[ex]) agg[ex] = {}
      if (!agg[ex][date]) agg[ex][date] = { totalReps: 0, maxWeight: 0 }
      agg[ex][date].totalReps += (s.sets ?? 1) * (s.reps ?? 0)
      agg[ex][date].maxWeight = Math.max(agg[ex][date].maxWeight, s.weight_kg ?? 0)
    }

    // 转成 ChartPoint[]
    const result: ExerciseData = {}
    for (const [ex, dateObj] of Object.entries(agg)) {
      result[ex] = Object.entries(dateObj).map(([date, vals]) => ({
        date,
        totalReps: vals.totalReps,
        maxWeight: vals.maxWeight > 0 ? vals.maxWeight : undefined,
      }))
    }

    // ✅ 找出自定义动作（在数据库有记录但不在预设列表里的）
    const custom = Object.keys(result).filter(ex => !ALL_PRESET_EXERCISES.has(ex))
    setCustomExercises(custom)
    setExerciseData(result)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">📊 训练数据</h1>
      </div>

      {/* Tab 横向滚动 */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedGroup(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedGroup === tab
                  ? tab === '✏️ 自定义' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>

        ) : selectedGroup === '✏️ 自定义' ? (
          // ✅ 自定义动作区块
          customExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="text-4xl">✏️</div>
              <p className="text-gray-400 text-sm">还没有自定义动作记录</p>
              <p className="text-gray-600 text-xs">在记录训练时手动输入动作名称，<br/>就会在这里自动显示趋势</p>
            </div>
          ) : (
            customExercises.map(exercise => (
              <ExerciseCard
                key={exercise}
                exercise={exercise}
                data={exerciseData[exercise] ?? []}
                // 自定义动作：若数据中有 maxWeight 就显示重量线
                hasWeight={(exerciseData[exercise] ?? []).some(d => d.maxWeight != null && d.maxWeight > 0)}
              />
            ))
          )

        ) : (
          // ✅ 预设肌肉群区块
          Object.entries(MUSCLE_CONFIG[selectedGroup] ?? {}).map(([exercise, hasWeight]) => (
            <ExerciseCard
              key={exercise}
              exercise={exercise}
              data={exerciseData[exercise] ?? []}
              hasWeight={hasWeight}
            />
          ))
        )}
      </div>
    </div>
  )
}