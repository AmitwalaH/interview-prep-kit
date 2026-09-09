import { z } from "zod";

export const CredentialsSchema = z.object({
  email: z.string().trim().email(),
  // Password length is limited to 72 characters because bcrypt truncates longer passwords.
  password: z.string().min(8).max(72),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
