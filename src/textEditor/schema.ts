import { Schema } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'

export const textEditorSchema = new Schema({
  // Extend the basic schema with ordered/bullet list + list_item definitions.
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks,
})
