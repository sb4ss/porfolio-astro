import { defineCollection, z } from "astro:content";

const projects = defineCollection({
  schema: z.object({
    title: z.string(),
    desc: z.string(),
    img: z.string(),
    tech: z.string(),
  }),
});

export const collections = { projects };
