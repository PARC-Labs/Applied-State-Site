import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

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
    publishedAt: z.coerce.date().optional(),
    summary: z.string().min(1).optional(),
  }),
})

export const collections = { instances }
