import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { generateSmartChatReply } from './smartChat.service';

const smartChatRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
  context: z
    .object({
      pathname: z.string().trim().max(500).optional(),
      routeLabel: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const postSmartChatMessage = async (req: Request, res: Response) => {
  const parsed = smartChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'SMART_CHAT_INVALID_REQUEST',
      'Invalid Smart Chat request',
      parsed.error.issues,
    );
  }

  const reply = await generateSmartChatReply({
    message: parsed.data.message,
    context: parsed.data.context,
    user: req.user
      ? { role: req.user.role ?? null, email: req.user.email ?? null }
      : undefined,
  });

  res.json(new ApiResponse({ reply }));
};
