import type { MissionId } from '@/lib/missions'

export type WorkflowVariant = 'internal-qa' | 'external-fact-finding' | 'fallback-agent'

export type WorkflowClassification = {
  operating_procedure: 'q-and-a' | 'fact-finding' | 'other'
}

export type WorkflowMissionUpdate = {
  mission_id: MissionId
  status: 'pending' | 'progress' | 'complete' | 'risk'
  evidence: string[]
}

export type WorkflowResult = {
  variant: WorkflowVariant
  outputText: string
  queryRewrite: string
  classification: WorkflowClassification
  conversation: unknown[]
  missionUpdates: WorkflowMissionUpdate[]
}

export type WorkflowContext = {
  candidate_id?: string
  vector_store_id?: string
}
