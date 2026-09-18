import { describe, expect, it } from 'vitest'
import {
  BRIDGE_MAX_DEPTH,
  BRIDGE_MAX_MESSAGE_BYTES,
  BRIDGE_MAX_NODES,
  BRIDGE_MAX_REPLY_BYTES,
  BRIDGE_MAX_REPLY_PARTS,
  parseBridgeMessage,
  utf8ByteLength
} from './bridge-caps'

/** A JSON document of exactly `bytes` UTF-8 bytes: a quoted run of ASCII. */
function jsonStringOfBytes(bytes: number): string {
  return `"${'x'.repeat(bytes - 2)}"`
}

/** A scalar nested inside `levels - 1` arrays, so the scalar itself sits at `levels`. */
function nestedArrays(levels: number): string {
  return `${'['.repeat(levels - 1)}0${']'.repeat(levels - 1)}`
}

/** An array holding `nodes - 1` scalars, so the array and its values total `nodes`. */
function arrayOfNodes(nodes: number): string {
  return `[${Array.from({ length: nodes - 1 }, () => '0').join(',')}]`
}

describe('utf8ByteLength', () => {
  it('agrees with TextEncoder across the encoding widths', () => {
    const encoder = new TextEncoder()
    for (const sample of ['', 'plain ascii', 'é', 'ünïcodé', '中文', '😀', 'a😀b中é']) {
      expect(utf8ByteLength(sample)).toBe(encoder.encode(sample).length)
    }
  })

  it('counts a lone surrogate as its replacement, like TextEncoder does', () => {
    const loneHigh = '\ud83d'
    const loneLow = '\ude00'
    expect(utf8ByteLength(loneHigh)).toBe(new TextEncoder().encode(loneHigh).length)
    expect(utf8ByteLength(`a${loneLow}b`)).toBe(new TextEncoder().encode(`a${loneLow}b`).length)
  })

  it('counts a surrogate pair once, not twice', () => {
    expect(utf8ByteLength('😀')).toBe(4)
    expect(utf8ByteLength('😀😀')).toBe(8)
  })
})

describe('parseBridgeMessage byte cap', () => {
  it('accepts a frame of exactly the cap', () => {
    const raw = jsonStringOfBytes(BRIDGE_MAX_MESSAGE_BYTES)
    expect(utf8ByteLength(raw)).toBe(BRIDGE_MAX_MESSAGE_BYTES)
    expect(parseBridgeMessage(raw).ok).toBe(true)
  })

  it('refuses a frame one byte over the cap', () => {
    const raw = jsonStringOfBytes(BRIDGE_MAX_MESSAGE_BYTES + 1)
    expect(parseBridgeMessage(raw)).toEqual({ ok: false, refusal: 'oversized' })
  })

  it('measures bytes, not code units, so multi-byte text cannot slip past', () => {
    // Half the cap in code units, every one of them two bytes: under the length guard, over the cap.
    const body = 'é'.repeat(BRIDGE_MAX_MESSAGE_BYTES / 2)
    const raw = `"${body}"`
    expect(raw.length).toBeLessThan(BRIDGE_MAX_MESSAGE_BYTES)
    expect(parseBridgeMessage(raw)).toEqual({ ok: false, refusal: 'oversized' })
  })
})

describe('parseBridgeMessage document caps', () => {
  it('refuses text that is not JSON', () => {
    expect(parseBridgeMessage('{')).toEqual({ ok: false, refusal: 'malformed-json' })
    expect(parseBridgeMessage('')).toEqual({ ok: false, refusal: 'malformed-json' })
  })

  it('accepts nesting of exactly the depth cap', () => {
    expect(parseBridgeMessage(nestedArrays(BRIDGE_MAX_DEPTH)).ok).toBe(true)
  })

  it('refuses nesting one level past the depth cap', () => {
    expect(parseBridgeMessage(nestedArrays(BRIDGE_MAX_DEPTH + 1))).toEqual({
      ok: false,
      refusal: 'too-deep'
    })
  })

  it('counts object nesting the same as array nesting', () => {
    const deep = `${'{"a":'.repeat(BRIDGE_MAX_DEPTH)}0${'}'.repeat(BRIDGE_MAX_DEPTH)}`
    expect(parseBridgeMessage(deep)).toEqual({ ok: false, refusal: 'too-deep' })
  })

  it('accepts exactly the node cap', () => {
    expect(parseBridgeMessage(arrayOfNodes(BRIDGE_MAX_NODES)).ok).toBe(true)
  })

  it('refuses one node past the cap', () => {
    expect(parseBridgeMessage(arrayOfNodes(BRIDGE_MAX_NODES + 1))).toEqual({
      ok: false,
      refusal: 'too-many-nodes'
    })
  })

  it('counts object values as nodes too', () => {
    const entries = Array.from({ length: BRIDGE_MAX_NODES }, (_, index) => `"k${index}":0`)
    expect(parseBridgeMessage(`{${entries.join(',')}}`)).toEqual({
      ok: false,
      refusal: 'too-many-nodes'
    })
  })

  it('returns the parsed document when every cap holds', () => {
    expect(parseBridgeMessage('{"v":1,"type":"ready"}')).toEqual({
      ok: true,
      message: { v: 1, type: 'ready' }
    })
  })
})

describe('derived caps', () => {
  it('allows enough parts for a ceiling-sized reply whose every byte re-escapes', () => {
    // A chunk is JSON text inside a JSON string, so re-escaping it at worst doubles it.
    const worstCaseFrames = Math.ceil((BRIDGE_MAX_REPLY_BYTES * 2) / BRIDGE_MAX_MESSAGE_BYTES)
    expect(BRIDGE_MAX_REPLY_PARTS).toBeGreaterThan(worstCaseFrames)
  })
})
