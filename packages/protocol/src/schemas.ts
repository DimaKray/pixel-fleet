import { z } from 'zod';
import { BOT_DIFFICULTIES } from '@pixelfleet/engine';

export const CoordSchema = z.object({ x: z.number().int(), y: z.number().int() }).strict();

export const ShipSchema = z
  .object({
    type: z.enum(['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer']),
    origin: CoordSchema,
    orientation: z.enum(['horizontal', 'vertical']),
  })
  .strict();

/** Код кімнати: 5 символів, регістр не важливий. */
export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{5}$/);

export const JoinRoomSchema = z.object({ code: RoomCodeSchema }).strict();
export const ResumeSchema = z.object({ token: z.string().min(1).max(100) }).strict();
export const CreateBotSchema = z.object({ difficulty: z.enum(BOT_DIFFICULTIES) }).strict();
/** Скільки кораблів у флоті, перевіряє рушій. Тут лише обмежуємо розмір повідомлення. */
export const PlaceFleetSchema = z.object({ ships: z.array(ShipSchema).max(10) }).strict();
export const FireSchema = CoordSchema;

export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type ResumePayload = z.infer<typeof ResumeSchema>;
export type CreateBotPayload = z.infer<typeof CreateBotSchema>;
export type PlaceFleetPayload = z.infer<typeof PlaceFleetSchema>;
export type FirePayload = z.infer<typeof FireSchema>;
