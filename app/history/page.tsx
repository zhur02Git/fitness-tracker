'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ✅ 肌肉群动作配置
const MUSCLE_GROUPS: Record<string, string[]> = {
  '🫁 胸': ['卧推', '哑铃夹胸', '器械上推'],
  '🦅 肩': ['飞鸟', '哑铃上推', '二头上推', '俯卧撑'],
  '🦈 背': ['引体向上', '划船', '高位下拉', '单臂划船'],
  '💪 手臂': ['哑铃后举', '哑铃锤举'],
  '🦵 腿': ['深蹲', '哑铃深蹲', '罗马尼亚硬拉', '保加利亚蹲', '单腿起', '器械举腿'],
}

const CARDIO_TYPES = ['跑步', '骑行', '游泳', '椭圆机', '跳绳', '其他']

type StrengthSet = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number
}

type CardioSession = {
  exercise_type: string
  duration_minutes: number
  distance_km: number | null
}

type Workout = {
  id: string
  date: string
  notes: string | null
  created_at: string
  strength_sets: StrengthSet[]
  cardio_sessions: CardioSession[]
}

type AddSet = {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 补录弹窗状态
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0])
  const [addType, setAddType] = useState<'strength' | 'cardio'>('strength')
  const [addNotes, setAddNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // 力量补录
  const [selectedGroup, setSelectedGroup] = useState(Object.keys(MUSCLE_GROUPS)[0])
  const [exercise, setExercise] = useState('')
  const [numSets, setNumSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(0)
  const [setList, setSetList] = useState<AddSet[]>([])

  // 有氧补录
  const [cardioType, setCardioType] = useState('跑步')
  const [duration, setDuration] = useState(30)
  const [distance, setDistance] = useState(0)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id, date, notes, created_at,
        strength_sets ( exercise_name, sets, reps, weight_kg ),
        cardio_sessions ( exercise_type, duration_minutes, distance_km )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) setWorkouts(data as Workout[])
    setLoading(false)
  }

  // ✅ 删除
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('workouts').delete().eq('id', deleteId)
    setWorkouts(prev => prev.filter(w => w.id !== deleteId))
    setDeleteId(null)
    setDeleting(false)
  }

  // ✅ 添加动作到列表
  const addToList = () => {
    if (!exercise) return
    setSetList(prev => [...prev, { exercise_name: exercise, sets: numSets, reps, weight_kg: weight }])
    setExercise('')
  }

  // ✅ 补录保存
  const handleSaveAdd = async () => {
    if (addType === 'strength' && setList.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // created_at 用选择的日期（中午12点，避免时区问题）
    const created_at = new Date(`${addDate}T12:00:00`).toISOString()

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, notes: addNotes, date: addDate, created_at })
      .select()
      .single()

    if (wErr || !workout) { setSaving(false); return }

    if (addType === 'strength') {
      await supabase.from('strength_sets').insert(
        setList.map(s => ({ ...s, workout_id: workout.id }))
      )
    } else {
      await supabase.from('cardio_sessions').insert({
        workout_id: workout.id,
        exercise_type: cardioType,
        duration_minutes: duration,
        distance_km: distance > 0 ? distance : null,
      })
    }

    // 重置
    setShowAdd(false)
    setSetList([])
    setAddNotes('')
    setDistance(0)
    setSaving(false)
    fetchHistory()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
          <h1 className="text-lg font-bold">📅 训练历史</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors"
        >
          + 补录
        </button>
      </div>

      {/* 历史列表 */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-5xl">📭</div>
            <p className="text-gray-400">还没有训练记录</p>
            <button onClick={() => setShowAdd(true)} className="text-blue-400 text-sm">点击补录历史记录</button>
          </div>
        ) : (
          workouts.map(w => (
            <div key={w.id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
              {/* 日期 + 删除 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{formatDate(w.created_at)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(w.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteId(w.id)}
                  className="text-gray-600 hover:text-red-400 text-lg transition-colors px-2"
                >
                  🗑
                </button>
              </div>

              {/* 力量记录 */}
              {w.strength_sets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium">🏋️ 力量训练</p>
                  {w.strength_sets.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                      <span className="text-sm">{s.exercise_name}</span>
                      <span className="text-xs text-gray-400">
                        {s.sets}组 × {s.reps}次{s.weight_kg > 0 ? ` · ${s.weight_kg}kg` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 有氧记录 */}
              {w.cardio_sessions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium">🏃 有氧运动</p>
                  {w.cardio_sessions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                      <span className="text-sm">{c.exercise_type}</span>
                      <span className="text-xs text-gray-400">
                        {c.duration_minutes}分钟{c.distance_km ? ` · ${c.distance_km}km` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {w.notes && (
                <p className="text-xs text-gray-500 italic">备注：{w.notes}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* ✅ 删除确认弹窗 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-center">删除这条记录？</h3>
            <p className="text-gray-400 text-sm text-center">删除后无法恢复</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white py-3 rounded-xl font-medium transition-colors"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 补录弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* 弹窗 Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="font-bold text-lg">📝 补录历史训练</h2>
              <button onClick={() => { setShowAdd(false); setSetList([]) }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="px-5 py-4 space-y-5 pb-10">
              {/* 日期选择 */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">训练日期</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={e => setAddDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 类型切换 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddType('strength')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${addType === 'strength' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  🏋️ 力量训练
                </button>
                <button
                  onClick={() => setAddType('cardio')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${addType === 'cardio' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  🏃 有氧运动
                </button>
              </div>

              {/* 力量训练表单 */}
              {addType === 'strength' && (
                <div className="space-y-4">
                  {/* 肌肉群 */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">肌肉群</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(MUSCLE_GROUPS).map(g => (
                        <button key={g} onClick={() => { setSelectedGroup(g); setExercise('') }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 动作选择 */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">动作</p>
                    <div className="flex flex-wrap gap-2">
                      {MUSCLE_GROUPS[selectedGroup].map(ex => (
                        <button key={ex} onClick={() => setExercise(ex)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${exercise === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                          {ex}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text" value={exercise} onChange={e => setExercise(e.target.value)}
                      placeholder="或手动输入..."
                      className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 组数/次数/重量 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[['组数', numSets, setNumSets], ['次数', reps, setReps], ['重量kg', weight, setWeight]].map(([label, val, setter]: any) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs text-gray-400">{label}</label>
                        <input type="number" value={val} onChange={e => setter(Number(e.target.value))} min={0} step={label === '重量kg' ? 0.5 : 1}
                          className="w-full bg-gray-800 rounded-xl px-2 py-2.5 text-center text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>

                  <button onClick={addToList} disabled={!exercise}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-2.5 text-sm font-medium">
                    + 添加到列表
                  </button>

                  {/* 已添加列表 */}
                  {setList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">已添加 ({setList.length})</p>
                      {setList.map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                          <span className="text-sm">{s.exercise_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">{s.sets}组×{s.reps}次{s.weight_kg > 0 ? ` ${s.weight_kg}kg` : ''}</span>
                            <button onClick={() => setSetList(prev => prev.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 有氧训练表单 */}
              {addType === 'cardio' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">运动类型</p>
                    <div className="flex flex-wrap gap-2">
                      {CARDIO_TYPES.map(t => (
                        <button key={t} onClick={() => setCardioType(t)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${cardioType === t ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">时长（分钟）</label>
                      <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={1}
                        className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">距离（km，选填）</label>
                      <input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} min={0} step={0.1}
                        className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-center text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* 备注 */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">备注（选填）</label>
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2} placeholder="今天的感受..."
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSaveAdd}
                disabled={saving || (addType === 'strength' && setList.length === 0)}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl py-4 font-semibold transition-colors"
              >
                {saving ? '保存中...' : '💾 保存记录'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}