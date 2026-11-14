import path from 'node:path';

export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (!['development', 'test', 'production'].includes(env.NODE_ENV ?? 'development')) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.startsWith('replace_')) {
    throw new Error('Set SESSION_SECRET to a unique value of at least 32 characters');
  }
  const bookingStartOffsetDays = Number(env.BOOKING_START_OFFSET_DAYS ?? 0);
  const bookingDays = Number(env.BOOKING_DAYS ?? 3);
  if (!Number.isInteger(bookingStartOffsetDays) || bookingStartOffsetDays < 0 || bookingStartOffsetDays > 7
    || !Number.isInteger(bookingDays) || bookingDays < 1 || bookingDays > 7) {
    throw new Error('BOOKING_START_OFFSET_DAYS and BOOKING_DAYS must be valid day counts');
  }
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port,
    databasePath: path.resolve(env.DATABASE_PATH ?? './data/parcel-pickup.sqlite'),
    sessionSecret: env.SESSION_SECRET,
    bookingStartOffsetDays,
    bookingDays,
  };
}
