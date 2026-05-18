import { promises as fs, constants as fsConstants } from "node:fs";
import { dirname } from "node:path";
import type { Profile } from "./schema.js";
import { ProfileSchema } from "./schema.js";

export class ProfileStore {
  constructor(private readonly path: string) {}

  async write(profile: unknown): Promise<Profile> {
    const validated = ProfileSchema.parse(profile);
    await this.writeAtomic(validated);
    return validated;
  }

  async read(): Promise<Profile | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
    return ProfileSchema.parse(JSON.parse(raw));
  }

  private async writeAtomic(profile: Profile): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    const handle = await fs.open(
      tmp,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC,
      0o600,
    );
    try {
      await handle.writeFile(JSON.stringify(profile, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.path);
  }
}
