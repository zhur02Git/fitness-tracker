'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

type Measurement = {
  id: string
  waist_cm: number | null
  weight_kg: number | null
  measured_at: string
}

export default function MeasurementsPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'waist' | 'weight'>('waist')

  // 表单
  const [waist, setWaist] = useState('')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchMeasurements()
  }, [])

  const fetchMeasurements = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: true })

    if (data) setMeasurements(data)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!waist && !weight) {
      setError('请至少输入腰围或体重')
      return
    }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: dbError } = await supabase
      .from('body_measurements')
      .insert({
        user_id: user.id,
        waist_cm: waist ? parseFloat(waist) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        measured_at: date
      })

    if (dbError) {
      setError('保存失败：' + dbError.message)
    } else {
      setWaist('')
      setWeight('')
      setDate(new Date().toISOString().split('T')[0])
      setShowForm(false)
      fetchMeasurements()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('body_measurements').delete().eq('id', id)
    fetchMeasurements()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  const chartData = measurements.map(m => ({
    date: new Date(m.measured_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    waist: m.waist_cm,
    weight: m.weight_kg,
  }))

  const waistData = measurements.filter(m => m.waist_cm)
  const weightData = measurements.filter(m => m.weight_kg)

  const getChange = (data: Measurement[], key: 'waist_cm' | 'weight_kg') => {
    const vals = data.map(d => d[key]).filter(Boolean) as number[]
    if (vals.length < 2) return null
    return (vals[vals.length - 1] - vals[0]).toFixed(1)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
          <p className="text-gray-400 mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }} className="font-medium">
              {p.value}{tab === 'waist' ? ' cm' : ' kg'}
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
      <div className="bg-gray-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl">←</button>
          <h1 className="text-lg font-bold">📏 身体数据</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + 记录
        </button>
      </div>

      {/* 录入表单 */}
      {showForm && (
        <div className="mx-4 mt-4 bg-gray-900 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-white">📝 新增记录</h2>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">腰围 (cm)</label>
              <input
                type="number"
                value={waist}
                onChange={e => setWaist(e.target.value)}
                placeholder="例：80.5"
                step="0.1"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">体重 (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="例：70.5"
                step="0.1"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl py-3 text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : measurements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="text-5xl">📏</div>
            <p className="text-gray-400 text-sm">还没有身体数据记录</p>
            <p className="text-gray-600 text-xs">点右上角"+ 记录"开始追踪</p>
          </div>
        ) : (
          <>
            {/* Tab */}
            <div className="bg-gray-900 rounded-2xl p-1 flex gap-1">
              <button onClick={() => setTab('waist')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === 'waist' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                📏 腰围
              </button>
              <button onClick={() => setTab('weight')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === 'weight' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                ⚖️ 体重
              </button>
            </div>

            {/* 折线图 */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-1">
                {tab === 'waist' ? '腰围变化趋势' : '体重变化趋势'}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {tab === 'waist' ? '单位：cm' : '单位：kg'}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={chartData.filter(d => tab === 'waist' ? d.waist : d.weight)}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={tab === 'waist' ? 'waist' : 'weight'}
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={{ fill: '#22C55E', r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 统计摘要 */}
            <div className="grid grid-cols-3 gap-3">
              {tab === 'waist' ? (
                <>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">最新腰围</p>
                    <p className="text-lg font-bold text-green-400 mt-1">
                      {waistData[waistData.length - 1]?.waist_cm ?? '–'}
                      <span className="text-xs font-normal text-gray-400"> cm</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">最小腰围</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">
                      {waistData.length > 0 ? Math.min(...waistData.map(d => d.waist_cm!)) : '–'}
                      <span className="text-xs font-normal text-gray-400"> cm</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">总变化</p>
                    <p className={`text-lg font-bold mt-1 ${
                      Number(getChange(waistData, 'waist_cm')) < 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {getChange(waistData, 'waist_cm') ? `${getChange(waistData, 'waist_cm')} cm` : '–'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">最新体重</p>
                    <p className="text-lg font-bold text-green-400 mt-1">
                      {weightData[weightData.length - 1]?.weight_kg ?? '–'}
                      <span className="text-xs font-normal text-gray-400"> kg</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">最低体重</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">
                      {weightData.length > 0 ? Math.min(...weightData.map(d => d.weight_kg!)) : '–'}
                      <span className="text-xs font-normal text-gray-400"> kg</span>
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400">总变化</p>
                    <p className={`text-lg font-bold mt-1 ${
                      Number(getChange(weightData, 'weight_kg')) < 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {getChange(weightData, 'weight_kg') ? `${getChange(weightData, 'weight_kg')} kg` : '–'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 历史记录列表 */}
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                所有记录（{measurements.length} 条）
              </p>
              <div className="space-y-2">
                {[...measurements].reverse().map(m => (
                  <div key={m.id} className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatDate(m.measured_at)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {m.waist_cm && `腰围 ${m.waist_cm} cm`}
                        {m.waist_cm && m.weight_kg && ' · '}
                        {m.weight_kg && `体重 ${m.weight_kg} kg`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-gray-600 hover:text-red-400 text-lg transition-colors ml-3"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}