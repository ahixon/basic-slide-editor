import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import type { Command, Plugin } from 'prosemirror-state'
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import { inputRules, wrappingInputRule } from 'prosemirror-inputrules'

import { createSharedCollaborationPlugins, type SharedCollaborationOptions } from '../extensions/SharedCollaboration'
import { textEditorSchema } from './schema'

export function createTextEditorPlugins(options: SharedCollaborationOptions): Plugin[] {
  const listKeymap = createListKeymap()
  const listInputRules = createListInputRules()
  const markKeymap = createMarkKeymap()
  return [
    ...(listInputRules ? [listInputRules] : []),
    ...(listKeymap ? [listKeymap] : []),
    ...(markKeymap ? [markKeymap] : []),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
    ...createSharedCollaborationPlugins(options),
  ]
}

function createListKeymap(): Plugin | null {
  const { list_item } = textEditorSchema.nodes
  if (!list_item) {
    return null
  }
  // Provide the expected Enter + indent/outdent behavior when editing list items.
  return keymap({
    Enter: splitListItem(list_item),
    'Mod-[': liftListItem(list_item),
    'Mod-]': sinkListItem(list_item),
  })
}

function createListInputRules(): Plugin | null {
  const { bullet_list, ordered_list } = textEditorSchema.nodes
  const rules = []
  if (bullet_list) {
    // Autowrap "* " / "- " prefixes into bullet lists, matching common editor UX.
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, bullet_list))
  }
  if (ordered_list) {
    rules.push(
      wrappingInputRule(/^\s*(\d+)\.\s$/, ordered_list, (match) => ({ order: Number(match[1]) })),
    )
  }
  return rules.length ? inputRules({ rules }) : null
}

function createMarkKeymap(): Plugin | null {
  const { strong, em } = textEditorSchema.marks
  const bindings: Record<string, Command> = {}
  if (strong) {
    bindings['Mod-b'] = toggleMark(strong)
  }
  if (em) {
    bindings['Mod-i'] = toggleMark(em)
  }
  return Object.keys(bindings).length ? keymap(bindings) : null
}
