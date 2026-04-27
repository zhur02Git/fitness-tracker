'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Set = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number
}

type HistoryRecord = {
  date: string
  sets: number
  reps: number
  weight_kg: number
}

type Review = {
  summary: string
  tips: string[]
  level: 'good' | 'warning' | 'info'
}

const MUSCLE_GROUPS: Record<string, string[]> = {
  '🫁 胸': ['卧推', '哑铃夹胸', '器械上推'],
  '🦅 肩': ['飞鸟', '哑铃肩推', '二头上推', '俯卧撑'],
  '🦈 背': ['引体向上', '划船', '高位下拉', '单臂划船', '悬垂举腿'],
  '💪 手臂': ['哑铃后举', '哑铃锤举'],
  '🦵 腿': ['深蹲', '哑铃深蹲', '罗马尼亚硬拉', '保加利亚蹲', '单腿起', '器械举腿'],
}

const BODYWEIGHT_EXERCISES = new Set(['引体向上', '深蹲', '俯卧撑', '悬垂举腿', '单腿起'])

// 每个动作属于哪个肌肉群
const EXERCISE_TO_GROUP: Record<string, string> = {}
Object.entries(MUSCLE_GROUPS).forEach(([group, exercises]) => {
  exercises.forEach(ex => { EXERCISE_TO_GROUP[ex] = group })
})

function generateReview(sets: Set[]): Review | null {
  if (sets.length === 0) return null

  const totalSets = sets.reduce((sum, s) => sum + s.sets, 0)
  const totalVolume = sets.reduce((sum, s) => sum + s.sets * s.reps * (s.weight_kg || 1), 0)
  const muscleGroups = new Set(sets.map(s => EXERCISE_TO_GROUP[s.exercise_name] || '其他'))
  const groupCount = muscleGroups.size
  const exerciseCount = sets.length

  const tips: string[] = []
  let summary = ''
  let level: Review['level'] = 'info'

  // 总组数评估
  if (totalSets > 20) {
    summary = `今日训练量偏大（共 ${totalSets} 组），注意恢复`
    level = 'warning'
    tips.push('41岁后恢复周期变长，建议控制在16组以内，质量优于数量')
  } else if (totalSets >= 12) {
    summary = `训练量充足（${totalSets} 组），完成度不错 💪`
    level = 'good'
  } else if (totalSets >= 6) {
    summary = `训练量适中（${totalSets} 组），适合维持状态`
    level = 'info'
  } else {
    summary = `今日训练量较少（${totalSets} 组），可作为恢复日`
    level = 'info'
  }

  // 肌肉群覆盖
  if (groupCount >= 3) {
    tips.push(`覆盖了 ${groupCount} 个肌肉群，是全身训练模式，注意各部位充分热身`)
  } else if (groupCount === 1) {
    tips.push(`单部位专项训练，可搭配对立肌群（如练胸配背）减少肌肉失衡`)
  }

  // 单个动作组数检查
  const heavySets = sets.filter(s => s.sets >= 6)
  if (heavySets.length > 0) {
    tips.push(`"${heavySets[0].exercise_name}" 组数较多（${heavySets[0].sets} 组），建议留意关节反应`)
  }

  // 腿部训练提醒
  if (!muscleGroups.has('🦵 腿') && groupCount >= 2) {
    tips.push('今日未包含腿部训练，腿部是最大肌群，每周至少练 1 次有助于整体代谢')
  }

  // 40+ 特别建议（每次训练都给一条）
  const ageTips = [
    '训练后补充蛋白质（30g以上）对40岁以上肌肉合成尤为重要',
    '每组间歇建议90-120秒，充分恢复比缩短间歇更有效',
    '关节热身5分钟可大幅降低受伤风险，尤其是肩、膝、腰',
  ]
  const ageTip = ageTips[exerciseCount % ageTips.length]
  if (tips.length < 2) tips.push(ageTip)

  return { summary, tips: tips.slice(0, 2), level }
}

export default function StrengthPage() {
  const [sets, setSets] = useState<Set[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>(Object.keys(MUSCLE_GROUPS)[0])
  const [exercise, setExercise] = useState('')
  const [numSets, setNumSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const review = useMemo(() => generateReview(sets), [sets])

  const fetchHistory = useCallback(async (exerciseName: string) => {
    if (!exerciseName.trim()) { setHistory([]); return }
    setHistoryLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHistoryLoading(false); return }

    const { data, error } = await supabase
      .from('strength_sets')
      .select(`sets, reps, weight_kg, workouts!inner(date, user_id)`)
      .eq('exercise_name', exerciseName)
      .eq('workouts.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (!error && data) {
      setHistory(data.map((row: any) => ({
        date: row.workouts.date,
        sets: row.sets,
        reps: row.reps,
        weight_kg: row.weight_kg,
      })))
    } else {
      setHistory([])
    }
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => {
    if (exercise) fetchHistory(exercise)
    else setHistory([])
  }, [exercise, fetchHistory])

  const addSet = () => {
    if (!exercise) return
    setSets([...sets, { exercise_name: exercise, sets: numSets, reps, weight_kg: weight }])
    setExercise('')
    setHistory([])
  }

  const removeSet = (index: number) => {
    setSets(sets.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (sets.length === 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, notes })
      .select()
      .single()

    if (workoutError || !workout) { setLoading(false); return }

    const { error: setsError } = await supabase
      .from('strength_sets')
      .insert(sets.map(s => ({ ...s, workout_id: workout.id })))

    if (!setsError) {
      setSaved(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  const showWeight = !BODYWEIGHT_EXERCISES.has(exercise)

  const levelStyle = {
    good: { border: 'border-green-500/30', bg: 'bg-green-500/10', icon: '✅', text: 'text-green-400', tip: 'text-green-300/80' },
    warning: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', icon: '⚠️', text: 'text-yellow-400', tip: 'text-yellow-300/80' },
    info: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: '📊', text: 'text-blue-400', tip: 'text-blue-300/80' },
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl">✅</div>
          <p className="text-lg font-semibold">训练已保存！</p>
          <p className="text-gray-400 text-sm">正在跳转...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">🏋️ 力量训练</h1>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* 肌肉群选择 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200 text-sm">选择肌肉群</h2>
          <div className="flex flex-wrap gap-2">
            {Object.keys(MUSCLE_GROUPS).map(group => (
              <button
                key={group}
                onClick={() => { setSelectedGroup(group); setExercise('') }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedGroup === group ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">选择动作</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS[selectedGroup].map(ex => (
                <button
                  key={ex}
                  onClick={() => setExercise(ex)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    exercise === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={exercise}
            onChange={e => setExercise(e.target.value)}
            placeholder="或手动输入动作名称..."
            className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 历史记录 */}
        {exercise && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-200 text-sm">📋 {exercise} · 最近记录</h2>
              {historyLoading && <span className="text-xs text-gray-500 animate-pulse">加载中...</span>}
            </div>
            {!historyLoading && history.length === 0 && (
              <p className="text-xs text-gray-500 py-1">暂无历史记录，今天是第一次！💪</p>
            )}
            {!historyLoading && history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-400">{formatDate(h.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-medium">{h.sets} 组 × {h.reps} 次</span>
                  {h.weight_kg > 0 && (
                    <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full">{h.weight_kg} kg</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 参数设定 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200 text-sm">参数设定</h2>
          <div className={`grid gap-3 ${showWeight ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">组数</label>
              <input type="number" value={numSets} onChange={e => setNumSets(Number(e.target.value))} min={1}
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">次数</label>
              <input type="number" value={reps} onChange={e => setReps(Number(e.target.value))} min={1}
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {showWeight && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400">重量 (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} min={0} step={0.5}
                  className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>
          <button onClick={addSet} disabled={!exercise}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-medium text-sm transition-colors">
            + 添加到训练列表
          </button>
        </div>

        {/* 今日训练列表 */}
        {sets.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-200 text-sm">今日训练列表</h2>
            {sets.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{s.exercise_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.sets} 组 × {s.reps} 次{s.weight_kg > 0 ? ` · ${s.weight_kg} kg` : ''}
                    <span className="ml-2 text-gray-500">
                      总量 {(s.sets * s.reps * (s.weight_kg || 1)).toFixed(0)} {s.weight_kg > 0 ? 'kg' : 'rep'}
                    </span>
                  </p>
                </div>
                <button onClick={() => removeSet(i)} className="text-gray-500 hover:text-red-400 text-lg transition-colors">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* AI点评卡片 */}
        {review && (() => {
          const style = levelStyle[review.level]
          return (
            <div className={`rounded-2xl p-4 border ${style.border} ${style.bg} space-y-3`}>
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">{style.icon}</span>
                <p className={`text-sm font-semibold ${style.text}`}>{review.summary}</p>
              </div>
              {review.tips.length > 0 && (
                <div className="space-y-2 pl-6">
                  {review.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-xs mt-0.5 ${style.tip}`}>•</span>
                      <p className={`text-xs leading-relaxed ${style.tip}`}>{tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* 备注 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
          <label className="text-sm font-semibold text-gray-200">备注（选填）</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="今天的感受、训练重点..." rows={3}
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* 保存 */}
        <button onClick={handleSave} disabled={sets.length === 0 || loading}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl py-4 font-semibold text-base transition-colors">
          {loading ? '保存中...' : `💾 保存训练 (${sets.length} 个动作)`}
        </button>
      </div>
    </div>
  )
}