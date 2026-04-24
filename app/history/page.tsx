'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { fetchCustomExerciseMap, saveCustomExercise } from '@/lib/customExercises'

const MUSCLE_GROUPS: Record<string, string[]> = {
  '🫁 胸': ['卧推', '哑铃夹胸', '器械上推'],
  '🦅 肩': ['飞鸟', '哑铃上推', '二头上推', '俯卧撑', '绳索下拉'],
  '🦈 背': ['引体向上', '划船', '高位下拉', '单臂划船', '悬垂举腿'],
  '💪 手臂': ['哑铃后举', '哑铃锤举', '绳索弯举'],
  '🦵 腿': ['深蹲', '哑铃深蹲', '罗马尼亚硬拉', '保加利亚蹲', '单腿起', '器械举腿'],
}

const ALL_PRESET_EXERCISES = new Set(Object.values(MUSCLE_GROUPS).flat())
const CARDIO_TYPES = ['跑步', '骑行', '游泳', '椭圆机', '跳绳', '其他']

type StrengthSet = {
  id?: string
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

// ✅ 动态肌肉群（预设 + 已归类自定义）
function useDynamicGroups(customMap: Record<string, string>) {
  const groups: Record<string, string[]> = {}
  for (const [g, exs] of Object.entries(MUSCLE_GROUPS)) groups[g] = [...exs]
  for (const [ex, group] of Object.entries(customMap)) {
    if (groups[group] && !groups[group].includes(ex)) groups[group].push(ex)
  }
  return groups
}

function EditSetModal({
  set,
  workoutId,
  customMap,
  onClose,
  onSaved,
}: {
  set: StrengthSet & { idx: number }
  workoutId: string
  customMap: Record<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const dynamicGroups = useDynamicGroups(customMap)

  const [exerciseName, setExerciseName] = useState(set.exercise_name)
  const [numSets, setNumSets] = useState(set.sets)
  const [reps, setReps] = useState(set.reps)
  const [weight, setWeight] = useState(set.weight_kg)
  const [activeGroup, setActiveGroup] = useState(Object.keys(MUSCLE_GROUPS)[0])
  const [customGroup, setCustomGroup] = useState(Object.keys(MUSCLE_GROUPS)[0])
  const [saving, setSaving] = useState(false)

  const isCustom = !ALL_PRESET_EXERCISES.has(exerciseName) && exerciseName.trim() !== ''

  const handleSave = async () => {
    setSaving(true)
    // ✅ 如果是自定义动作，保存归属分类
    if (isCustom) await saveCustomExercise(exerciseName.trim(), customGroup)

    if (set.id) {
      await supabase.from('strength_sets')
        .update({ exercise_name: exerciseName, sets: numSets, reps, weight_kg: weight })
        .eq('id', set.id)
    } else {
      await supabase.from('strength_sets')
        .update({ exercise_name: exerciseName, sets: numSets, reps, weight_kg: weight })
        .eq('workout_id', workoutId)
        .eq('exercise_name', set.exercise_name)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-gray-900 rounded-t-3xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="font-bold text-lg">✏️ 修改训练记录</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="px-5 py-5 space-y-5 pb-10">
          {/* 动作名 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">动作名称</label>
            <input type="text" value={exerciseName} onChange={e => setExerciseName(e.target.value)}
              className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

            {/* 快速选动作（含已归类自定义） */}
            <div className="space-y-2 pt-1">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {Object.keys(dynamicGroups).map(g => (
                  <button key={g} onClick={() => setActiveGroup(g)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${activeGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(dynamicGroups[activeGroup] ?? []).map(ex => (
                  <button key={ex} onClick={() => setExerciseName(ex)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${exerciseName === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ✅ 自定义动作选归属分类 */}
          {isCustom && (
            <div className="bg-gray-800 border border-yellow-500/30 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-yellow-400">✨ 自定义动作，选择归属肌肉群（保存后自动同步到趋势图）</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(MUSCLE_GROUPS).map(g => (
                  <button key={g} onClick={() => setCustomGroup(g)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${customGroup === g ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 组数 / 次数 / 重量 */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ['组数', numSets, setNumSets, 1],
              ['次数', reps, setReps, 1],
              ['重量 kg', weight, setWeight, 0.5],
            ] as [string, number, (v: number) => void, number][]).map(([label, val, setter, step]) => (
              <div key={label} className="space-y-1">
                <label className="text-xs text-gray-400 block text-center">{label}</label>
                <div className="flex items-center bg-gray-800 rounded-xl overflow-hidden">
                  <button onClick={() => setter(Math.max(0, val - step))}
                    className="px-3 py-3 text-gray-400 hover:text-white active:bg-gray-700 text-lg leading-none">−</button>
                  <input type="number" value={val} onChange={e => setter(Number(e.target.value))} min={0} step={step}
                    className="flex-1 bg-transparent text-center text-white text-sm focus:outline-none w-0" />
                  <button onClick={() => setter(val + step)}
                    className="px-3 py-3 text-gray-400 hover:text-white active:bg-gray-700 text-lg leading-none">+</button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSave} disabled={saving || !exerciseName.trim()}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl py-4 font-semibold transition-colors">
            {saving ? '保存中...' : '✅ 保存修改'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editSet, setEditSet] = useState<(StrengthSet & { idx: number; workoutId: string }) | null>(null)
  const [customMap, setCustomMap] = useState<Record<string, string>>({})

  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0])
  const [addType, setAddType] = useState<'strength' | 'cardio'>('strength')
  const [addNotes, setAddNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState(Object.keys(MUSCLE_GROUPS)[0])
  const [exercise, setExercise] = useState('')
  const [customInputGroup, setCustomInputGroup] = useState(Object.keys(MUSCLE_GROUPS)[0])
  const [numSets, setNumSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(0)
  const [setList, setSetList] = useState<AddSet[]>([])

  const [cardioType, setCardioType] = useState('跑步')
  const [duration, setDuration] = useState(30)
  const [distance, setDistance] = useState(0)

  const router = useRouter()
  const supabase = createClient()

  // 动态肌肉群（含已归类自定义）
  const dynamicGroups = useDynamicGroups(customMap)

  useEffect(() => { init() }, [])

  const init = async () => {
    const map = await fetchCustomExerciseMap()
    setCustomMap(map)
    await fetchHistory()
  }

  const fetchHistory = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('workouts')
      .select(`id, date, notes, created_at,
        strength_sets ( id, exercise_name, sets, reps, weight_kg ),
        cardio_sessions ( exercise_type, duration_minutes, distance_km )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) setWorkouts(data as Workout[])
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('workouts').delete().eq('id', deleteId)
    setWorkouts(prev => prev.filter(w => w.id !== deleteId))
    setDeleteId(null)
    setDeleting(false)
  }

  const isCustomExercise = !ALL_PRESET_EXERCISES.has(exercise) && exercise.trim() !== ''

  const addToList = () => {
    if (!exercise) return
    setSetList(prev => [...prev, { exercise_name: exercise, sets: numSets, reps, weight_kg: weight }])
    setExercise('')
  }

  const handleSaveAdd = async () => {
    if (addType === 'strength' && setList.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // ✅ 补录时，自定义动作也保存分类
    for (const s of setList) {
      if (!ALL_PRESET_EXERCISES.has(s.exercise_name)) {
        await saveCustomExercise(s.exercise_name, customInputGroup)
      }
    }

    const created_at = new Date(`${addDate}T12:00:00`).toISOString()
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, notes: addNotes, date: addDate, created_at })
      .select().single()

    if (wErr || !workout) { setSaving(false); return }

    if (addType === 'strength') {
      await supabase.from('strength_sets').insert(
        setList.map(s => ({ ...s, workout_id: workout.id }))
      )
    } else {
      await supabase.from('cardio_sessions').insert({
        workout_id: workout.id, exercise_type: cardioType,
        duration_minutes: duration, distance_km: distance > 0 ? distance : null,
      })
    }

    setShowAdd(false); setSetList([]); setAddNotes(''); setDistance(0)
    setSaving(false)
    const map = await fetchCustomExerciseMap()
    setCustomMap(map)
    fetchHistory()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = Math.floor((new Date().getTime() - d.getTime()) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="bg-gray-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
          <h1 className="text-lg font-bold">📅 训练历史</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors">
          + 补录
        </button>
      </div>

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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{formatDate(w.created_at)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(w.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setDeleteId(w.id)}
                  className="text-gray-600 hover:text-red-400 text-lg transition-colors px-2">🗑</button>
              </div>

              {w.strength_sets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium">🏋️ 力量训练 <span className="text-gray-600">（点击可修改）</span></p>
                  {w.strength_sets.map((s, i) => (
                    <button key={i} onClick={() => setEditSet({ ...s, idx: i, workoutId: w.id })}
                      className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl px-3 py-2.5 transition-colors text-left">
                      <span className="text-sm">{s.exercise_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {s.sets}组 × {s.reps}次{s.weight_kg > 0 ? ` · ${s.weight_kg}kg` : ''}
                        </span>
                        <span className="text-gray-600 text-xs">✏️</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

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

              {w.notes && <p className="text-xs text-gray-500 italic">备注：{w.notes}</p>}
            </div>
          ))
        )}
      </div>

      {/* 编辑弹窗 */}
      {editSet && (
        <EditSetModal
          set={editSet}
          workoutId={editSet.workoutId}
          customMap={customMap}
          onClose={() => setEditSet(null)}
          onSaved={async () => {
            setEditSet(null)
            const map = await fetchCustomExerciseMap()
            setCustomMap(map)
            fetchHistory()
          }}
        />
      )}

      {/* 删除确认 */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg text-center">删除这条记录？</h3>
            <p className="text-gray-400 text-sm text-center">删除后无法恢复</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors">取消</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white py-3 rounded-xl font-medium transition-colors">
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 补录弹窗 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50">
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="font-bold text-lg">📝 补录历史训练</h2>
              <button onClick={() => { setShowAdd(false); setSetList([]) }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="px-5 py-4 space-y-5 pb-10">
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">训练日期</label>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAddType('strength')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${addType === 'strength' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  🏋️ 力量训练
                </button>
                <button onClick={() => setAddType('cardio')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${addType === 'cardio' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  🏃 有氧运动
                </button>
              </div>

              {addType === 'strength' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">肌肉群</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(dynamicGroups).map(g => (
                        <button key={g} onClick={() => { setSelectedGroup(g); setExercise('') }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">动作</p>
                    <div className="flex flex-wrap gap-2">
                      {(dynamicGroups[selectedGroup] ?? []).map(ex => (
                        <button key={ex} onClick={() => setExercise(ex)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-colors ${exercise === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                          {ex}
                        </button>
                      ))}
                    </div>
                    <input type="text" value={exercise} onChange={e => setExercise(e.target.value)}
                      placeholder="或手动输入自定义动作..."
                      className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />

                    {/* ✅ 自定义动作选分类 */}
                    {isCustomExercise && (
                      <div className="bg-gray-800 border border-yellow-500/30 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-xs text-yellow-400">✨ 自定义动作，请选择归属肌肉群</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(MUSCLE_GROUPS).map(g => (
                            <button key={g} onClick={() => setCustomInputGroup(g)}
                              className={`px-3 py-1 rounded-full text-xs transition-colors ${customInputGroup === g ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([['组数', numSets, setNumSets, 1], ['次数', reps, setReps, 1], ['重量kg', weight, setWeight, 0.5]] as any[]).map(([label, val, setter, step]) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs text-gray-400">{label}</label>
                        <input type="number" value={val} onChange={e => setter(Number(e.target.value))} min={0} step={step}
                          className="w-full bg-gray-800 rounded-xl px-2 py-2.5 text-center text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    ))}
                  </div>

                  <button onClick={addToList} disabled={!exercise}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-2.5 text-sm font-medium">
                    + 添加到列表
                  </button>

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

              <div className="space-y-2">
                <label className="text-sm text-gray-400">备注（选填）</label>
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2} placeholder="今天的感受..."
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <button onClick={handleSaveAdd}
                disabled={saving || (addType === 'strength' && setList.length === 0)}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-2xl py-4 font-semibold transition-colors">
                {saving ? '保存中...' : '💾 保存记录'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}