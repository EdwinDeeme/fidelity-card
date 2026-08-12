import { z } from "zod";

export const activateDeviceSchema = z.object({
  activation_code: z.string().min(8).max(128),
  pin: z.string().min(4).max(32),
  device_name: z.string().min(2).max(80),
});

export const createCardSchema = z.object({
  stamp_limit: z.number().int().min(1).max(20),
  reward_name: z.string().min(2).max(80),
  reward_description: z.string().max(160).optional(),
  customer_name: z.string().min(2).max(120).optional(),
});

export const stampSchema = z.object({
  action: z.literal("ADD"),
});
