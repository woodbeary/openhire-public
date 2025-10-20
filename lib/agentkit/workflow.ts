'use server'

import { Agent, AgentInputItem, Runner, webSearchTool, codeInterpreterTool, tool, withTrace } from '@openai/agents'
import { z } from 'zod'

import { DEFAULT_WORKFLOW_ID } from './constants'
import type { WorkflowClassification, WorkflowResult, WorkflowContext, WorkflowMissionUpdate } from './types'
import type { MissionId } from '@/lib/missions'
import { buildMissionChecklistWidget } from '@/lib/chatkit/mission-checklist'

const webSearchPreview = webSearchTool({
  searchContextSize: 'medium',
  userLocation: {
    type: 'approximate',
  },
})

const codeInterpreter = codeInterpreterTool({
  container: {
    type: 'auto',
    file_ids: [],
  },
})

const ClassifySchema = z.object({
  operating_procedure: z.enum(['q-and-a', 'fact-finding', 'other']),
})

const missionIdValues = [
  'mission_alignment',
  'safety_mindset',
  'execution_ownership',
  'xf_collaboration',
  'routing_recommendation',
] as const satisfies readonly MissionId[]

const MissionStatusSchema = z.enum(['pending', 'progress', 'complete', 'risk'])

const MissionUpdateSchema = z.object({
  mission_id: z.enum(missionIdValues),
  status: MissionStatusSchema.optional(),
  evidence: z.union([z.string(), z.array(z.string())]).optional(),
})

type MissionStatus = z.infer<typeof MissionStatusSchema>

type MissionUpdate = {
  mission_id: MissionId
  status: MissionStatus
  evidence: string[]
}

const queryRewrite = new Agent({
  name: 'Query rewrite',
  instructions: "Rewrite the user's question to be more specific and relevant to the knowledge base.",
  model: 'gpt-5',
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
})

const classify = new Agent({
  name: 'Classify',
  instructions: 'Determine whether the question should use the Q&A or fact-finding process.',
  model: 'gpt-5',
  outputType: ClassifySchema,
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
})

const fallbackAgent = new Agent({
  name: 'Agent',
  instructions:
    'Ask the user to provide more detail so you can help them by either answering their question or running data analysis relevant to their query',
  model: 'gpt-4.1-nano',
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true,
  },
})

type WorkflowInput = { input_as_text: string; context?: WorkflowContext }

const workflowId = process.env.OPENAI_CHATKIT_WORKFLOW_ID ?? DEFAULT_WORKFLOW_ID

export async function runWorkflow(workflow: WorkflowInput): Promise<WorkflowResult> {
  const conversationHistory: AgentInputItem[] = [
    workflow.context && (workflow.context.candidate_id || workflow.context.vector_store_id)
      ? {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `Context: candidate_id=${workflow.context.candidate_id ?? 'n/a'}; vector_store_id=${workflow.context.vector_store_id ?? 'n/a'}`,
            },
          ],
        }
      : undefined,
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: workflow.input_as_text,
        },
      ],
    },
  ].filter(Boolean) as AgentInputItem[]

  const missionUpdates: MissionUpdate[] = []

  const missionUpdateTool = tool({
    name: 'openhire.mission_update',
    description:
      'Update the recruiter mission checklist. Provide mission_id, optional status (progress/complete/risk), and a short evidence snippet or list.',
    parameters: MissionUpdateSchema,
    execute: async (rawInput) => {
      const parsed = MissionUpdateSchema.parse(rawInput)
      const evidenceEntries = parsed.evidence
        ? Array.isArray(parsed.evidence)
          ? parsed.evidence
          : [parsed.evidence]
        : []

      const normalizedEvidence = evidenceEntries
        .map((text) => text.trim())
        .filter((text) => text.length > 0)
        .map((text) => (text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text))

      missionUpdates.push({
        mission_id: parsed.mission_id,
        status: parsed.status ?? 'progress',
        evidence: normalizedEvidence,
      })

      return { acknowledged: true }
    },
  })

  const internalQA = new Agent({
    name: 'Internal Q&A',
    instructions:
      "Answer the user's question using the knowledge tools you have on hand (file or web search). Be concise and answer succinctly, using bullet points and summarizing the answer up front.\n\nWhenever you observe evidence for a recruiter mission signal (mission alignment, safety mindset, execution ownership, cross-functional collaboration, routing recommendation), call the `openhire.mission_update` tool with:\n- mission_id set to the matching signal\n- status set to `progress` while gathering evidence, `complete` when you are confident, or `risk` if the evidence is negative\n- evidence containing a short quote or paraphrased sentence from the candidate.\nAfter emitting updates, continue responding normally.",
    model: 'gpt-5',
    tools: [webSearchPreview, missionUpdateTool],
    modelSettings: {
      reasoning: {
        effort: 'low',
        summary: 'auto',
      },
      store: true,
    },
  })

  const externalFactFinding = new Agent({
    name: 'External fact finding',
    instructions:
      'Explore external information using the tools you have (web search, file search, code interpreter).\nAnalyze any relevant data, checking your work.\n\nWhen you uncover evidence tied to recruiter missions, call the `openhire.mission_update` tool with the appropriate mission_id, status (progress/complete/risk), and a concise evidence snippet before continuing your summary.',
    model: 'gpt-5',
    tools: [webSearchPreview, codeInterpreter, missionUpdateTool],
    modelSettings: {
      reasoning: {
        effort: 'low',
        summary: 'auto',
      },
      store: true,
    },
  })

  const runner = new Runner({
    traceMetadata: {
      __trace_source__: 'agent-builder',
      workflow_id: workflowId,
    },
  })

  return withTrace('agent_workflow_published', async () => {
    const queryRewriteResultTemp = await runner.run(queryRewrite, [
      ...conversationHistory,
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Original question: ${workflow.input_as_text}`,
          },
        ],
      },
    ])

    conversationHistory.push(...queryRewriteResultTemp.newItems.map((item) => item.rawItem))

    const queryRewriteResult = queryRewriteResultTemp.finalOutput
    if (!queryRewriteResult) {
      throw new Error('Query rewrite agent returned no output')
    }

    const classifyResultTemp = await runner.run(classify, [
      ...conversationHistory,
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Question: ${queryRewriteResult}`,
          },
        ],
      },
    ])

    conversationHistory.push(...classifyResultTemp.newItems.map((item) => item.rawItem))

    const classifyResult = classifyResultTemp.finalOutput
    if (!classifyResult) {
      throw new Error('Classification agent returned no output')
    }

    const finalize = (variant: WorkflowResult['variant'], outputText: string): WorkflowResult => {
      const missionUpdateResults: WorkflowMissionUpdate[] = missionUpdates.map((update) => ({
        mission_id: update.mission_id,
        status: update.status,
        evidence: [...update.evidence],
      }))

      const widgets = [buildMissionChecklistWidget(missionUpdateResults)]

      return {
        variant,
        outputText,
        queryRewrite: queryRewriteResult,
        classification: classifyResult as WorkflowClassification,
        conversation: conversationHistory,
        missionUpdates: missionUpdateResults,
        widgets,
      }
    }

    if (classifyResult.operating_procedure === 'q-and-a') {
      const internalQAResultTemp = await runner.run(internalQA, [...conversationHistory])
      conversationHistory.push(...internalQAResultTemp.newItems.map((item) => item.rawItem))

      const internalQAResult = internalQAResultTemp.finalOutput
      if (!internalQAResult) {
        throw new Error('Internal Q&A agent returned no output')
      }

      return finalize('internal-qa', internalQAResult)
    }

    if (classifyResult.operating_procedure === 'fact-finding') {
      const externalFactFindingResultTemp = await runner.run(externalFactFinding, [...conversationHistory])
      conversationHistory.push(...externalFactFindingResultTemp.newItems.map((item) => item.rawItem))

      const externalFactFindingResult = externalFactFindingResultTemp.finalOutput
      if (!externalFactFindingResult) {
        throw new Error('External fact finding agent returned no output')
      }

      return finalize('external-fact-finding', externalFactFindingResult)
    }

    const fallbackResultTemp = await runner.run(fallbackAgent, [...conversationHistory])
    conversationHistory.push(...fallbackResultTemp.newItems.map((item) => item.rawItem))

    const fallbackResult = fallbackResultTemp.finalOutput
    if (!fallbackResult) {
      throw new Error('Fallback agent returned no output')
    }

    return finalize('fallback-agent', fallbackResult)
  })
}
