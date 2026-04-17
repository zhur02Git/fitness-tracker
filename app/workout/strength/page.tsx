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

const COMMON_EXERCISES = ['卧推', '深蹲', '硬拉', '引体向上', '肩推', '划船', '弯举', '三头下压']

export default function StrengthPage() {
  const [sets, setSets] = useState<Set[]>([])
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

    // 创建 workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, notes })
      .select()
      .single()

    if (workoutError || !workout) {
      setLoading(false)
      return
    }

    // 插入所有训练组
    const { error: setsError } = await supabase
      .from('strength_sets')
      .insert(sets.map(s => ({ ...s, workout_id: workout.id })))

    if (!setsError) {
      setSaved(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-lg font-bold">🏋️ 力量训练</h1>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* 添加动作 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200">添加动作</h2>

          {/* 快速选择 */}
          <div className="flex flex-wrap gap-2">
            {COMMON_EXERCISES.map(ex => (
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

          {/* 自定义输入 */}
          <input
            type="text"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="或输入自定义动作名称"
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
          />

          {/* 组数/次数/重量 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">组数</label>
              <input
                type="number"
                value={numSets}
                onChange={(e) => setNumSets(Number(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">次数</label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">重量(kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
            </div>
          </div>

          <button
            onClick={addSet}
            disabled={!exercise}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            + 添加到本次训练
          </button>
        </div>

        {/* 已添加列表 */}
        {sets.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-200">本次训练 ({sets.length} 个动作)</h2>
            {sets.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <div className="font-medium text-sm">{s.exercise_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.sets}组 × {s.reps}次 · {s.weight_kg}kg
                  </div>
                </div>
                <button
                  onClick={() => removeSet(i)}
                  className="text-gray-600 hover:text-red-400 text-lg transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 备注 */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <label className="text-sm text-gray-400 mb-2 block">训练备注（可选）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="今天感觉怎么样？"
            rows={3}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 resize-none"
          />
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={sets.length === 0 || loading || saved}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition-colors"
        >
          {saved ? '✅ 已保存！' : loading ? '保存中...' : '完成训练 · 保存记录'}
        </button>

      </div>
    </div>
  )
}