import type { Widgets } from '@openai/chatkit'

import type { MissionId } from '@/lib/missions'

export type WorkflowVariant = 'internal-qa' | 'external-fact-finding' | 'fallback-agent'

export type WorkflowClassification = {
  operating_procedure: 'q-and-a' | 'fact-finding' | 'other'
}

export type MissionStatus = 'pending' | 'progress' | 'complete' | 'risk'

export type WorkflowMissionUpdate = {
  mission_id: MissionId
  status: MissionStatus
  evidence: string[]
}

export type WorkflowWidget = {
  id: string
  kind: 'mission-checklist'
  root: Widgets.WidgetRoot
  updatedAt: string
}

export type WorkflowResult = {
  variant: WorkflowVariant
  outputText: string
  queryRewrite: string
  classification: WorkflowClassification
  conversation: unknown[]
  missionUpdates: WorkflowMissionUpdate[]
  widgets: WorkflowWidget[]
}

export type WorkflowContext = {
  candidate_id?: string
  vector_store_id?: string
}
