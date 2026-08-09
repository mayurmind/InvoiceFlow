const DURATION_REGEX = /^[1-9][0-9]*(s|m|h|d)$/;

export const parseDurationToMs = (duration: string): number => {
  const match = duration.match(DURATION_REGEX);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(duration.slice(0, -1), 10);
  const unit = duration.slice(-1);

  if (!Number.isSafeInteger(value)) {
    throw new Error('Duration value exceeds safe integer limits');
  }

  let ms = 0;
  switch (unit) {
    case 's':
      ms = value * 1000;
      break;
    case 'm':
      ms = value * 60 * 1000;
      break;
    case 'h':
      ms = value * 60 * 60 * 1000;
      break;
    case 'd':
      ms = value * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }

  if (!Number.isSafeInteger(ms)) {
    throw new Error('Duration converted to ms exceeds safe integer limits');
  }

  return ms;
};
