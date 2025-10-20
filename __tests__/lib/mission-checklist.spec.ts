import { describe, expect, it } from 'vitest'

import { buildMissionChecklistWidget } from '@/lib/chatkit/mission-checklist'
import type { Widgets } from '@openai/chatkit'

describe('buildMissionChecklistWidget', () => {
  it('returns a default checklist with pending statuses', () => {
    const widget = buildMissionChecklistWidget([])

    expect(widget.id).toBe('openhire.mission_checklist')
    expect(widget.kind).toBe('mission-checklist')
    expect(widget.root.type).toBe('Card')

    const listView = widget.root.children[widget.root.children.length - 1] as Widgets.ListView
    expect(listView.type).toBe('ListView')
    expect(listView.children).toHaveLength(5)

    const firstItem = listView.children[0] as Widgets.ListViewItem
    const row = firstItem.children[0] as Widgets.Row
    const badge = row.children[1] as Widgets.Badge

    expect(badge.label).toBe('Pending')
  })

  it('maps mission updates into badges and evidence', () => {
    const widget = buildMissionChecklistWidget([
      {
        mission_id: 'mission_alignment',
        status: 'complete',
        evidence: ['Speaks passionately about OpenAI mission.'],
      },
      {
        mission_id: 'safety_mindset',
        status: 'risk',
        evidence: ['Dismissed safety guardrails to meet a deadline.'],
      },
    ])

    const listView = widget.root.children[widget.root.children.length - 1] as Widgets.ListView

    const alignmentItem = listView.children.find((item) => item.key === 'mission_alignment') as Widgets.ListViewItem
    const alignmentRow = alignmentItem.children[0] as Widgets.Row
    const alignmentBadge = alignmentRow.children[1] as Widgets.Badge
    expect(alignmentBadge.label).toBe('Backed')

    const detailsCol = (alignmentRow.children[0] as Widgets.Row).children[1] as Widgets.Col
    const evidenceNode = detailsCol.children[2]
    expect(evidenceNode?.type).toBe('Row')
    if (evidenceNode?.type === 'Row') {
      const snippet = evidenceNode.children[1] as Widgets.Caption
      expect(snippet.value).toContain('passionately')
    }

    const safetyItem = listView.children.find((item) => item.key === 'safety_mindset') as Widgets.ListViewItem
    const safetyBadge = (safetyItem.children[0] as Widgets.Row).children[1] as Widgets.Badge
    expect(safetyBadge.label).toBe('Risk')
  })
})
