'use server'

import { NextResponse } from 'next/server'

import { runWorkflow } from '@/lib/agentkit/workflow'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message : undefined
    const candidate_id = typeof body?.candidate_id === 'string' ? body.candidate_id : undefined
    const vector_store_id = typeof body?.vector_store_id === 'string' ? body.vector_store_id : undefined

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Missing message payload.' }, { status: 400 })
    }

    const result = await runWorkflow({ input_as_text: message, context: { candidate_id, vector_store_id } })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Workflow execution error', error)
    return NextResponse.json(
      {
        error: 'Unexpected error while executing workflow.',
      },
      { status: 500 },
    )
  }
}
