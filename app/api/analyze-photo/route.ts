import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 每次请求时才初始化，确保读到最新环境变量
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('API KEY:', apiKey?.slice(0, 15))

  if (!apiKey) {
    return NextResponse.json({ error: 'API Key 未配置' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  try {
    const body = await request.json()
    const { imageBase64, part, mode, previousBase64 } = body

    if (!imageBase64) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 })
    }

    if (mode === 'quality') {
      const prompt = part === 'face'
        ? `你是健身App的照片质量检查员，标准要宽松友好。请检查这张脸部照片。

判断标准（只要基本符合就算通过）：
1. 有人脸出现在画面中
2. 光线不是完全黑暗
3. 不是纯模糊到看不清脸

大部分普通自拍都应该通过，只有极端情况才不通过。

请用JSON格式回复，只回复JSON：
{
  "pass": true或false,
  "score": 1到10的数字,
  "issues": ["只列真正严重的问题，没有就返回空数组"],
  "tips": ["1-2条简单建议"]
}`
        : `你是健身App的照片质量检查员，标准要宽松友好。请检查这张腰腹部照片。

判断标准（只要基本符合就算通过）：
1. 画面中有人体腰腹部区域
2. 光线不是完全黑暗
3. 不是纯模糊到看不清

请用JSON格式回复，只回复JSON：
{
  "pass": true或false,
  "score": 1到10的数字,
  "issues": ["只列真正严重的问题，没有就返回空数组"],
  "tips": ["1-2条简单建议"]
}`

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const clean = text.replace(/```json|```/g, '').trim()

      let result
      try {
        result = JSON.parse(clean)
      } catch {
        result = { pass: true, score: 7, issues: [], tips: [] }
      }

      return NextResponse.json({
        pass: result.pass ?? true,
        score: result.score ?? 7,
        issues: Array.isArray(result.issues) ? result.issues : [],
        tips: Array.isArray(result.tips) ? result.tips : [],
      })

    } else if (mode === 'compare') {
      if (!previousBase64) {
        return NextResponse.json({ error: '缺少对比图片' }, { status: 400 })
      }

      const partLabel = part === 'face' ? '脸部' : '腰部/腹部'

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: previousBase64 }
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
            },
            {
              type: 'text',
              text: `这是同一个人的两张${partLabel}照片，第一张是之前的，第二张是最新的。
请分析身体变化，用JSON格式回复，只回复JSON：
{
  "summary": "整体变化总结（2-3句话）",
  "changes": ["具体变化1", "具体变化2", "具体变化3"],
  "progress": "positive或neutral或negative",
  "encouragement": "一句鼓励的话"
}`
            }
          ]
        }]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const clean = text.replace(/```json|```/g, '').trim()

      let result
      try {
        result = JSON.parse(clean)
      } catch {
        result = {
          summary: '照片对比完成，继续保持训练！',
          changes: ['保持了良好的训练习惯'],
          progress: 'neutral',
          encouragement: '坚持就是胜利！'
        }
      }

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

  } catch (error) {
    console.error('AI分析错误:', error)
    return NextResponse.json(
      { error: 'AI分析失败', detail: String(error) },
      { status: 500 }
    )
  }
}