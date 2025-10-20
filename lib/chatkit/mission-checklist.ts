import type { Widgets } from '@openai/chatkit'

import missionChecklistTemplate from '@/chatkit/widgets/mission-checklist.json'
import { missionDefinitions, type MissionId } from '@/lib/missions'

import type { WorkflowMissionUpdate, MissionStatus, WorkflowWidget } from '@/lib/agentkit/types'

type MissionChecklistTemplate = typeof missionChecklistTemplate

type MissionChecklistItem = MissionChecklistTemplate['items'][number]

type MissionChecklistBadgeConfig = MissionChecklistTemplate['badgeVariants'][MissionStatus]

type MissionStateSnapshot = {
  status: MissionStatus
  evidence: string[]
}

const defaultBadge: MissionChecklistBadgeConfig = missionChecklistTemplate.badgeVariants.pending

const badgeForStatus = (status: MissionStatus): MissionChecklistBadgeConfig => {
  return missionChecklistTemplate.badgeVariants[status] ?? defaultBadge
}

const prepareEvidence = (evidence: string[] | undefined, current: string[]): string[] => {
  if (!evidence) {
    return current
  }
  const next = [...current]
  for (const entry of evidence) {
    if (typeof entry !== 'string') {
      continue
    }
    const trimmed = entry.trim()
    if (!trimmed) {
      continue
    }
    const clipped = trimmed.length > 240 ? `${trimmed.slice(0, 237).trimEnd()}…` : trimmed
    if (!next.includes(clipped)) {
      next.push(clipped)
    }
  }
  if (next.length > 5) {
    return next.slice(next.length - 5)
  }
  return next
}

const createInitialState = (): Map<MissionId, MissionStateSnapshot> => {
  const map = new Map<MissionId, MissionStateSnapshot>()
  for (const mission of missionDefinitions) {
    map.set(mission.id, { status: 'pending', evidence: [] })
  }
  return map
}

const applyMissionUpdates = (
  updates: WorkflowMissionUpdate[],
  baseState: Map<MissionId, MissionStateSnapshot>,
): Map<MissionId, MissionStateSnapshot> => {
  const state = new Map<MissionId, MissionStateSnapshot>(baseState)
  for (const update of updates) {
    const current = state.get(update.mission_id)
    if (!current) {
      continue
    }
    const status = update.status ?? current.status
    const evidence = prepareEvidence(update.evidence, current.evidence)
    state.set(update.mission_id, { status, evidence })
  }
  return state
}

const buildEvidenceNode = (latestEvidence: string | null): Widgets.Row | Widgets.Caption => {
  if (!latestEvidence) {
    return {
      type: 'Caption',
      value: missionChecklistTemplate.emptyEvidenceLabel,
      color: '#97a0b6',
    }
  }
  return {
    type: 'Row',
    align: 'center',
    gap: 6,
    children: [
      {
        type: 'Icon',
        name: 'notebook-pencil',
        size: 'sm',
        color: '#6e7689',
      },
      {
        type: 'Caption',
        value: `“${latestEvidence}”`,
        color: '#505769',
      },
    ],
  }
}

const buildMissionRow = (
  item: MissionChecklistItem,
  state: MissionStateSnapshot,
): Widgets.ListViewItem => {
  const badge = badgeForStatus(state.status)
  const latestEvidence = state.evidence.length > 0 ? state.evidence[state.evidence.length - 1] : null

  return {
    type: 'ListViewItem',
    key: item.mission_id,
    children: [
      {
        type: 'Row',
        align: 'center',
        gap: 12,
        children: [
          {
            type: 'Row',
            align: 'start',
            gap: 12,
            children: [
              {
                type: 'Icon',
                name: item.icon as Widgets.WidgetIcon,
                color: '#2D5BFF',
                size: 'lg',
              },
              {
                type: 'Col',
                gap: 6,
                children: [
                  {
                    type: 'Text',
                    value: item.title,
                    weight: 'semibold',
                    color: '#0a0f18',
                  },
                  {
                    type: 'Text',
                    value: item.description,
                    size: 'sm',
                    color: '#5a6171',
                  },
                  buildEvidenceNode(latestEvidence),
                ],
              },
            ],
          },
          {
            type: 'Badge',
            label: badge.label,
            color: badge.color as Widgets.Badge['color'],
            variant: badge.variant as Widgets.Badge['variant'],
            size: 'sm',
            pill: true,
          },
        ],
      },
    ],
  }
}

const buildListView = (
  itemTemplates: MissionChecklistItem[],
  state: Map<MissionId, MissionStateSnapshot>,
): Widgets.ListView => {
  return {
    type: 'ListView',
    id: `${missionChecklistTemplate.id}.list`,
    children: itemTemplates.map((item) => {
      const missionId = item.mission_id as MissionId
      const missionState = state.get(missionId) ?? { status: 'pending', evidence: [] }
      return buildMissionRow(item, missionState)
    }),
  }
}

export const buildMissionChecklistWidget = (
  updates: WorkflowMissionUpdate[],
): WorkflowWidget => {
  const initialState = createInitialState()
  const state = applyMissionUpdates(updates, initialState)
  const listView = buildListView(missionChecklistTemplate.items, state)

  const children: Widgets.WidgetComponent[] = [
    {
      type: 'Row',
      align: 'start',
      justify: 'between',
      children: [
        {
          type: 'Col',
          gap: 4,
          children: [
            {
              type: 'Title',
              value: missionChecklistTemplate.title,
              size: 'sm',
              weight: 'semibold',
              color: '#0a0f18',
            },
            {
              type: 'Caption',
              value: missionChecklistTemplate.subtitle,
              size: 'sm',
              color: '#5a6171',
            },
          ],
        },
      ],
    },
  ]

  if (missionChecklistTemplate.listView?.divider) {
    children.push({
      type: 'Divider',
      spacing: missionChecklistTemplate.listView.divider.spacing,
      color: missionChecklistTemplate.listView.divider.color,
    })
  }

  children.push(listView as unknown as Widgets.WidgetComponent)

  const root: Widgets.Card = {
    type: 'Card',
    id: missionChecklistTemplate.id,
    padding: missionChecklistTemplate.card?.padding,
    background: missionChecklistTemplate.card?.background,
    children,
  }

  return {
    id: missionChecklistTemplate.id,
    kind: 'mission-checklist',
    root,
    updatedAt: new Date().toISOString(),
  }
}

export type MissionChecklistWidget = ReturnType<typeof buildMissionChecklistWidget>
