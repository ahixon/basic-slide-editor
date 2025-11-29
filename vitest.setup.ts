import { TextEncoder, TextDecoder } from 'util'

if (!globalThis.TextEncoder) {
  // @ts-expect-error - jsdom environment
  globalThis.TextEncoder = TextEncoder
}

if (!globalThis.TextDecoder) {
  // @ts-expect-error - jsdom environment
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder
}
