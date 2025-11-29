import { EditorState } from 'prosemirror-state'

import type { SharedCollaborationOptions } from '../extensions/SharedCollaboration'
import { textEditorSchema } from './schema'
import { createTextEditorPlugins } from './plugins'

export type CreateTextEditorStateOptions = SharedCollaborationOptions

export function createTextEditorState(options: CreateTextEditorStateOptions): EditorState {
  return EditorState.create({
    schema: textEditorSchema,
    plugins: createTextEditorPlugins(options),
  })
}
