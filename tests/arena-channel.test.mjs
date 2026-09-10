import assert from 'node:assert/strict'
import test from 'node:test'

import {
  arenaContentsApiUrl,
  fetchArenaContents,
  normalizeArenaItem,
  parseArenaChannelReference,
  parseArenaContentsPage,
  safeHttpsUrl,
} from '../src/lib/arena.ts'

test('Are.na channel references accept channel URLs and reject unsafe locations', () => {
  assert.deepEqual(
    parseArenaChannelReference('https://www.are.na/applied-state/as01?sample=true#fragment'),
    { slug: 'as01', webUrl: 'https://www.are.na/applied-state/as01' },
  )
  assert.deepEqual(parseArenaChannelReference('as01-research'), {
    slug: 'as01-research',
    webUrl: 'https://www.are.na/as01-research',
  })
  assert.equal(parseArenaChannelReference('https://evil.example/applied-state/as01'), null)
  assert.equal(parseArenaChannelReference('https://www.are.na/block/1234'), null)
  assert.equal(parseArenaChannelReference('javascript:alert(1)'), null)
})

test('Are.na API URLs are fixed to the public V3 contents endpoint', () => {
  assert.equal(
    arenaContentsApiUrl('as01-research', 2),
    'https://api.are.na/v3/channels/as01-research/contents?page=2&per=100',
  )
  assert.throws(() => arenaContentsApiUrl('../users', 1))
  assert.throws(() => arenaContentsApiUrl('as01', 0))
  assert.throws(() => arenaContentsApiUrl('as01', 1, 101))
})

test('external content URLs are restricted to HTTPS', () => {
  assert.equal(safeHttpsUrl('https://example.test/work'), 'https://example.test/work')
  assert.equal(safeHttpsUrl('http://example.test/work'), null)
  assert.equal(safeHttpsUrl('data:text/html,unsafe'), null)
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null)
})

test('V3 items are normalized without accepting Are.na HTML', () => {
  const item = normalizeArenaItem({
    id: 42,
    type: 'Text',
    title: '<img src=x onerror=alert(1)>',
    content: {
      plain: 'Safe text',
      html: '<script>unsafe()</script>',
    },
    description: {
      markdown: '**Description**',
      html: '<img src=x onerror=alert(1)>',
    },
  })

  assert.deepEqual(item, {
    id: '42',
    type: 'Text',
    title: '<img src=x onerror=alert(1)>',
    text: 'Safe text',
    description: '**Description**',
    sourceUrl: null,
    attachmentUrl: null,
    image: null,
    webUrl: 'https://www.are.na/block/42',
  })
  assert.ok(!JSON.stringify(item).includes('<script>'))
})

test('V3 image renditions and channel links normalize to display-safe data', () => {
  const image = normalizeArenaItem({
    id: 7,
    type: 'Image',
    title: 'Study',
    image: {
      alt_text: 'A study',
      width: 1600,
      height: 900,
      src: 'https://original.example.test/image.jpg',
      large: {
        src: 'https://images.are.na/large.jpg',
        src_2x: 'https://images.are.na/large-2x.jpg',
        width: 1200,
        height: 675,
      },
    },
  })
  assert.deepEqual(image?.image, {
    src: 'https://images.are.na/large.jpg',
    src2x: 'https://images.are.na/large-2x.jpg',
    width: 1200,
    height: 675,
    alt: 'A study',
  })

  const channel = normalizeArenaItem({
    id: 9,
    type: 'Channel',
    slug: 'references',
    title: 'References',
    owner: { slug: 'applied-state' },
  })
  assert.equal(channel?.webUrl, 'https://www.are.na/applied-state/references')
})

test('contents parsing preserves the channel order and pagination metadata', () => {
  const parsed = parseArenaContentsPage({
    meta: { next_page: 2, total_count: 3 },
    data: [
      { id: 3, type: 'Text', content: { plain: 'Third' } },
      { id: 2, type: 'Text', content: { plain: 'Second' } },
      { id: 1, type: 'Text', content: { plain: 'First' } },
    ],
  })
  assert.deepEqual(parsed.items.map((item) => item.id), ['3', '2', '1'])
  assert.equal(parsed.nextPage, 2)
  assert.equal(parsed.totalCount, 3)
  assert.throws(() => parseArenaContentsPage({ contents: [] }))
})

test('channel fetching follows pagination with a strict request cap', async () => {
  const requested = []
  const fetcher = async (url) => {
    requested.push(url)
    const page = Number(new URL(url).searchParams.get('page'))
    return new Response(JSON.stringify({
      meta: {
        next_page: page < 4 ? page + 1 : null,
        total_count: 4,
      },
      data: [{ id: page, type: 'Text', content: { plain: `Page ${page}` } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const result = await fetchArenaContents('as01', { fetcher, maxPages: 3 })
  assert.deepEqual(result.items.map((item) => item.id), ['1', '2', '3'])
  assert.equal(result.truncated, true)
  assert.equal(result.totalCount, 4)
  assert.equal(requested.length, 3)
})
