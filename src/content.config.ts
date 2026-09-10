import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { parseArenaChannelReference } from './lib/arena'

const instances = defineCollection({
  loader: glob({
    pattern: '**/*.(md|mdx)',
    base: './src/content/instances',
  }),
  schema: z.object({
    code: z.string().regex(/^AS\d{2,}$/),
    title: z.string().min(1).optional(),
    status: z.enum(['published', 'reserved', 'draft']),
    memberEnhanced: z.boolean().optional().default(false),
    arenaChannel: z.string().refine(
      (value) => Boolean(parseArenaChannelReference(value)),
      'Use a valid Are.na channel slug or full https://www.are.na/... channel URL.',
    ).optional(),
    publishedAt: z.coerce.date().optional(),
    summary: z.string().min(1).optional(),
  }),
})

export const collections = { instances }
