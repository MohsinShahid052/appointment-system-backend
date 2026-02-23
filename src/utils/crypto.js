import crypto from "crypto";

const ALGO = "aes-256-gcm";
const SECRET = process.env.CLIENT_ENCRYPTION_KEY; // must be 32 bytes
const HASH_SECRET = process.env.CLIENT_HASH_SECRET; // for hashing phone numbers

// --- AES ENCRYPT ---
export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(SECRET), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
};

// --- AES DECRYPT ---
export const decrypt = (data) => {
  const [ivHex, authTagHex, encrypted] = data.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, Buffer.from(SECRET), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

// --- HASH PHONE NUMBER ---
export const hashPhone = (phone) => {
  return crypto
    .createHmac("sha256", HASH_SECRET)
    .update(phone)
    .digest("hex");
};
