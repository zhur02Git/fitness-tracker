'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { fetchCustomExerciseMap, saveCustomExercise } from '@/lib/customExercises'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const MUSCLE_CONFIG: Record<string, string[]> = {
  '🫁 胸': ['卧推', '哑铃夹胸', '器械上推'],
  '🦅 肩': ['飞鸟', '哑铃上推', '二头上推', '俯卧撑', '绳索下拉'],
  '🦈 背': ['引体向上', '划船', '高位下拉', '单臂划船', '悬垂举腿'],
  '💪 手臂': ['哑铃后举', '哑铃锤举', '绳索弯举'],
  '🦵 腿': ['深蹲', '哑铃深蹲', '罗马尼亚硬拉', '保加利亚蹲', '单腿起', '器械举腿'],
}

const ALL_PRESET_EXERCISES = new Set(Object.values(MUSCLE_CONFIG).flat())

type ChartPoint = { date: string; totalReps: number; maxWeight?: number }
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

// ✅ 分类选择弹窗
function ReclassifyModal({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: string
  onClose: () => void
  onSaved: (group: string) => void
}) {
  const [selected, setSelected] = useState(Object.keys(MUSCLE_CONFIG)[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await saveCustomExercise(exercise, selected)
    setSaving(false)
    onSaved(selected)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
      <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">移动「{exercise}」到</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="flex flex-col gap-2">
          {Object.keys(MUSCLE_CONFIG).map(g => (
            <button
              key={g}
              onClick={() => setSelected(g)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                selected === g
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white rounded-xl py-3 font-semibold transition-colors"
        >
          {saving ? '保存中...' : '✅ 确认移动'}
        </button>
      </div>
    </div>
  )
}

// ✅ 普通动作卡片（预设肌肉群用）
function ExerciseCard({ exercise, data }: { exercise: string; data: ChartPoint[] }) {
  const hasWeight = data.some(d => d.maxWeight != null && d.maxWeight > 0)
  const hasData = data.length > 0

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{exercise}</h3>
        {hasData
          ? <span className="text-xs text-gray-400">{data.length} 次记录</span>
          : <span className="text-xs text-gray-600">暂无数据</span>}
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
              {hasWeight && <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} yAxisId="weight" orientation="right" />}
              <Tooltip content={<CustomTooltip />} />
              <Line yAxisId="reps" type="monotone" dataKey="totalReps" name="总次数"
                stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
              {hasWeight && (
                <Line yAxisId="weight" type="monotone" dataKey="maxWeight" name="最大重量"
                  stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-gray-400">最近总次数</p>
              <p className="font-bold text-blue-400 text-sm mt-0.5">{data[data.length - 1].totalReps} 次</p>
            </div>
            {hasWeight && data[data.length - 1].maxWeight != null && (
              <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-gray-400">最近最大重量</p>
                <p className="font-bold text-green-400 text-sm mt-0.5">{data[data.length - 1].maxWeight} kg</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ✅ 自定义动作卡片（带「移动」按钮）
function CustomExerciseCard({
  exercise,
  data,
  onReclassify,
}: {
  exercise: string
  data: ChartPoint[]
  onReclassify: () => void
}) {
  const hasWeight = data.some(d => d.maxWeight != null && d.maxWeight > 0)
  const hasData = data.length > 0

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{exercise}</h3>
        <div className="flex items-center gap-2">
          {hasData && <span className="text-xs text-gray-400">{data.length} 次记录</span>}
          {/* ✅ 移动按钮 */}
          <button
            onClick={onReclassify}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <span>移动</span>
            <span className="text-gray-500">›</span>
          </button>
        </div>
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
              {hasWeight && <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} yAxisId="weight" orientation="right" />}
              <Tooltip content={<CustomTooltip />} />
              <Line yAxisId="reps" type="monotone" dataKey="totalReps" name="总次数"
                stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
              {hasWeight && (
                <Line yAxisId="weight" type="monotone" dataKey="maxWeight" name="最大重量"
                  stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-gray-400">最近总次数</p>
              <p className="font-bold text-blue-400 text-sm mt-0.5">{data[data.length - 1].totalReps} 次</p>
            </div>
            {hasWeight && data[data.length - 1].maxWeight != null && (
              <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-gray-400">最近最大重量</p>
                <p className="font-bold text-green-400 text-sm mt-0.5">{data[data.length - 1].maxWeight} kg</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function StatsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tabs, setTabs] = useState<string[]>([...Object.keys(MUSCLE_CONFIG), '✏️ 自定义'])
  const [selectedGroup, setSelectedGroup] = useState(Object.keys(MUSCLE_CONFIG)[0])
  const [exerciseData, setExerciseData] = useState<ExerciseData>({})
  const [groupMap, setGroupMap] = useState<Record<string, string[]>>({ ...MUSCLE_CONFIG })
  const [ungroupedCustom, setUngroupedCustom] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // ✅ 当前要重新分类的动作
  const [reclassifyTarget, setReclassifyTarget] = useState<string | null>(null)

  useEffect(() => { fetchAllData() }, [])

  const fetchAllData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [workoutsRes, customMap] = await Promise.all([
      supabase.from('workouts').select('id, created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      fetchCustomExerciseMap(),
    ])

    const workouts = workoutsRes.data ?? []
    if (workouts.length === 0) { setLoading(false); return }

    const workoutIds = workouts.map(w => w.id)
    const dateMap: Record<string, string> = {}
    for (const w of workouts) {
      dateMap[w.id] = new Date(w.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }

    const { data: sets } = await supabase
      .from('strength_sets')
      .select('workout_id, exercise_name, sets, reps, weight_kg')
      .in('workout_id', workoutIds)

    if (!sets) { setLoading(false); return }

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

    const result: ExerciseData = {}
    for (const [ex, dateObj] of Object.entries(agg)) {
      result[ex] = Object.entries(dateObj).map(([date, vals]) => ({
        date,
        totalReps: vals.totalReps,
        maxWeight: vals.maxWeight > 0 ? vals.maxWeight : undefined,
      }))
    }

    // 构建 groupMap
    const newGroupMap: Record<string, string[]> = {}
    for (const [group, exercises] of Object.entries(MUSCLE_CONFIG)) {
      newGroupMap[group] = [...exercises]
    }

    const ungrouped: string[] = []
    for (const ex of Object.keys(result)) {
      if (ALL_PRESET_EXERCISES.has(ex)) continue
      const assignedGroup = customMap[ex]
      if (assignedGroup && newGroupMap[assignedGroup]) {
        if (!newGroupMap[assignedGroup].includes(ex)) newGroupMap[assignedGroup].push(ex)
      } else {
        ungrouped.push(ex)
      }
    }

    setGroupMap(newGroupMap)
    setUngroupedCustom(ungrouped)
    setExerciseData(result)

    const newTabs = [...Object.keys(MUSCLE_CONFIG)]
    if (ungrouped.length > 0) newTabs.push('✏️ 自定义')
    setTabs(newTabs)

    // ✅ 如果自定义 tab 已没有动作，切回第一个 tab
    if (ungrouped.length === 0 && selectedGroup === '✏️ 自定义') {
      setSelectedGroup(Object.keys(MUSCLE_CONFIG)[0])
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">📊 训练数据</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setSelectedGroup(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedGroup === tab
                  ? tab === '✏️ 自定义' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}>
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
          ungroupedCustom.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="text-gray-400 text-sm">所有自定义动作已归类</p>
            </div>
          ) : (
            ungroupedCustom.map(exercise => (
              <CustomExerciseCard
                key={exercise}
                exercise={exercise}
                data={exerciseData[exercise] ?? []}
                onReclassify={() => setReclassifyTarget(exercise)}
              />
            ))
          )
        ) : (
          (groupMap[selectedGroup] ?? []).map(exercise => (
            <ExerciseCard
              key={exercise}
              exercise={exercise}
              data={exerciseData[exercise] ?? []}
            />
          ))
        )}
      </div>

      {/* ✅ 分类选择弹窗 */}
      {reclassifyTarget && (
        <ReclassifyModal
          exercise={reclassifyTarget}
          onClose={() => setReclassifyTarget(null)}
          onSaved={(group) => {
            setReclassifyTarget(null)
            // 乐观更新：从 ungrouped 移除，加入对应 groupMap
            setUngroupedCustom(prev => prev.filter(e => e !== reclassifyTarget))
            setGroupMap(prev => {
              const next = { ...prev }
              if (!next[group].includes(reclassifyTarget)) {
                next[group] = [...next[group], reclassifyTarget]
              }
              return next
            })
            // 如果 ungrouped 清空了，移除自定义 tab 并跳转
            setUngroupedCustom(prev => {
              const remaining = prev.filter(e => e !== reclassifyTarget)
              if (remaining.length === 0) {
                setTabs([...Object.keys(MUSCLE_CONFIG)])
                setSelectedGroup(group) // 跳到刚归类的那个 tab
              }
              return remaining
            })
          }}
        />
      )}
    </div>
  )
}