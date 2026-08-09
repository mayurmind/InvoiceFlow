import * as argon2 from 'argon2';

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;

export const validatePasswordPolicy = (password: string): void => {
  if (password.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters long`);
  }
  if (password.length > MAX_LENGTH) {
    throw new Error(`Password must be at most ${MAX_LENGTH} characters long`);
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  validatePasswordPolicy(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
};

export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};
