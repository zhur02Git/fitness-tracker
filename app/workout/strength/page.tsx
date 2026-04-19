'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Set = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number
}

const MUSCLE_GROUPS: Record<string, string[]> = {
  '🫁 胸': ['卧推', '哑铃夹胸', '器械上推'],
  '🦅 肩': ['飞鸟', '哑铃肩推', '二头上推', '俯卧撑'],
  '🦈 背': ['引体向上', '划船', '高位下拉', '单臂划船'],
  '💪 手臂': ['哑铃后举', '哑铃锤举'],
  '🦵 腿': ['深蹲', '哑铃深蹲', '罗马尼亚硬拉', '保加利亚蹲', '单腿起', '器械举腿'],
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
  const router = useRouter()
  const supabase = createClient()

  const addSet = () => {
    if (!exercise) return
    setSets([...sets, {
      exercise_name: exercise,
      sets: numSets,
      reps,
      weight_kg: weight
    }])
    setExercise('')
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
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">🏋️ 力量训练</h1>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* 肌肉群 Tab */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200 text-sm">选择肌肉群</h2>
          <div className="flex flex-wrap gap-2">
            {Object.keys(MUSCLE_GROUPS).map(group => (
              <button
                key={group}
                onClick={() => { setSelectedGroup(group); setExercise('') }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedGroup === group
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* 该肌肉群的动作 */}
          <div>
            <p className="text-xs text-gray-400 mb-2">选择动作</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS[selectedGroup].map(ex => (
                <button
                  key={ex}
                  onClick={() => setExercise(ex)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    exercise === ex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义输入 */}
          <input
            type="text"
            value={exercise}
            onChange={e => setExercise(e.target.value)}
            placeholder="或手动输入动作名称..."
            className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 组数 / 次数 / 重量 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200 text-sm">参数设定</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">组数</label>
              <input
                type="number"
                value={numSets}
                onChange={e => setNumSets(Number(e.target.value))}
                min={1}
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">次数</label>
              <input
                type="number"
                value={reps}
                onChange={e => setReps(Number(e.target.value))}
                min={1}
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">重量 (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                min={0}
                step={0.5}
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={addSet}
            disabled={!exercise}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            + 添加到训练列表
          </button>
        </div>

        {/* 已添加的动作 */}
        {sets.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-200 text-sm">今日训练列表</h2>
            {sets.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{s.exercise_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.sets} 组 × {s.reps} 次
                    {s.weight_kg > 0 ? ` · ${s.weight_kg} kg` : ''}
                  </p>
                </div>
                <button
                  onClick={() => removeSet(i)}
                  className="text-gray-500 hover:text-red-400 text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 备注 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
          <label className="text-sm font-semibold text-gray-200">备注（选填）</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="今天的感受、训练重点..."
            rows={3}
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={sets.length === 0 || loading}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl py-4 font-semibold text-base transition-colors"
        >
          {loading ? '保存中...' : `💾 保存训练 (${sets.length} 个动作)`}
        </button>
      </div>
    </div>
  )
}