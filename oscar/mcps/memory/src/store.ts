import { promises as fs, constants as fsConstants } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const NoteSchema = z.object({
  scope_id: z.string().min(1),
  body: z.string(),
  created_at: z.string(),
});

export const FileSchema = z.object({
  notes: z.array(NoteSchema),
});

export type Note = z.infer<typeof NoteSchema>;
export type FileShape = z.infer<typeof FileSchema>;

export class NotesStore {
  constructor(private readonly path: string) {}

  async read(): Promise<FileShape> {
    let raw: string;
    try {
      raw = await fs.readFile(this.path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { notes: [] };
      }
      throw err;
    }
    return FileSchema.parse(JSON.parse(raw));
  }

  async append(scope_id: string, body: string): Promise<Note> {
    const file = await this.read();
    const note: Note = {
      scope_id,
      body,
      created_at: new Date().toISOString(),
    };
    file.notes.push(note);
    await this.writeAtomic(file);
    return note;
  }

  async byScope(scope_id: string): Promise<Note[]> {
    const file = await this.read();
    return file.notes
      .filter((n) => n.scope_id === scope_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  private async writeAtomic(file: FileShape): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    const handle = await fs.open(tmp, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC, 0o600);
    try {
      await handle.writeFile(JSON.stringify(file, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.path);
  }
}
