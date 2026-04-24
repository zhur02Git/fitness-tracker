import { createClient } from '@/lib/supabase'

// 获取所有自定义动作映射 { exercise_name -> muscle_group }
export async function fetchCustomExerciseMap(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('custom_exercises')
    .select('exercise_name, muscle_group')
  if (!data) return {}
  const map: Record<string, string> = {}
  for (const row of data) map[row.exercise_name] = row.muscle_group
  return map
}

// 保存或更新一个自定义动作的分类
export async function saveCustomExercise(exercise_name: string, muscle_group: string) {
  const supabase = createClient()
  await supabase
    .from('custom_exercises')
    .upsert({ exercise_name, muscle_group }, { onConflict: 'exercise_name' })
}