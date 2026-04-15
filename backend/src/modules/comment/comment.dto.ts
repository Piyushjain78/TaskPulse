import { z } from "zod";

export const createCommentDto = z.object({
  message: z.string().min(1).max(8000),
  parentId: z.string().uuid().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentDto>;
