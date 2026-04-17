'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const CARDIO_TYPES = ['跑步', '骑车', '游泳', '跳绳', '椭圆机', '划船机', '爬楼梯', '步行']

export default function CardioPage() {
  const [exerciseType, setExerciseType] = useState('')
  const [duration, setDuration] = useState(30)
  const [distance, setDistance] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    if (!exerciseType || !duration) return
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

    // 插入有氧记录
    const { error } = await supabase
      .from('cardio_sessions')
      .insert({
        workout_id: workout.id,
        exercise_type: exerciseType,
        duration_minutes: duration,
        distance_km: distance === '' ? null : distance,
      })

    if (!error) {
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
        <h1 className="text-lg font-bold">🏃 有氧运动</h1>
      </div>

      <div className="px-4 py-6 space-y-6">

        {/* 选择运动类型 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200">运动类型</h2>

          <div className="flex flex-wrap gap-2">
            {CARDIO_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setExerciseType(type)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  exerciseType === type
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={exerciseType}
            onChange={(e) => setExerciseType(e.target.value)}
            placeholder="或输入自定义运动"
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-600"
          />
        </div>

        {/* 时长和距离 */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-gray-200">运动数据</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">时长（分钟）</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-center"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">距离（km，可选）</label>
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="–"
                step="0.1"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-center placeholder-gray-600"
              />
            </div>
          </div>

          {/* 时长快速选择 */}
          <div>
            <p className="text-xs text-gray-400 mb-2">快速选择时长</p>
            <div className="flex gap-2">
              {[15, 20, 30, 45, 60].map(min => (
                <button
                  key={min}
                  onClick={() => setDuration(min)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    duration === min
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {min}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 预览卡片 */}
        {exerciseType && (
          <div className="bg-orange-950/40 border border-orange-800/40 rounded-2xl p-4">
            <p className="text-xs text-orange-400 mb-2">本次训练预览</p>
            <p className="text-white font-semibold">{exerciseType}</p>
            <p className="text-gray-300 text-sm mt-1">
              {duration} 分钟
              {distance !== '' && ` · ${distance} km`}
            </p>
          </div>
        )}

        {/* 备注 */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <label className="text-sm text-gray-400 mb-2 block">备注（可选）</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="今天跑得怎么样？"
            rows={3}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-600 resize-none"
          />
        </div>

        {/* 保存 */}
        <button
          onClick={handleSave}
          disabled={!exerciseType || !duration || loading || saved}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition-colors"
        >
          {saved ? '✅ 已保存！' : loading ? '保存中...' : '完成训练 · 保存记录'}
        </button>

      </div>
    </div>
  )
}