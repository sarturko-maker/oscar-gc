import * as fs from "node:fs";
import * as path from "node:path";

export interface Observation {
  value: number;
  context?: string;
  timestamp: string;
}

export interface BaselineStats {
  dimension: string;
  sampleSize: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  lastUpdated: string;
}

export interface BaselineViolation {
  dimension: string;
  observed: number;
  expectedMean: number;
  expectedStdDev: number;
  sigma: number;
  severity: "ok" | "warning" | "regression";
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export class BaselineStore {
  private inMemory: Map<string, Observation[]> = new Map();

  constructor(private readonly dir: string | null) {
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private safeKey(dimension: string): string {
    return dimension.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private fileFor(dimension: string): string | null {
    if (!this.dir) return null;
    return path.join(this.dir, `${this.safeKey(dimension)}.json`);
  }

  private load(dimension: string): Observation[] {
    if (this.inMemory.has(dimension)) return this.inMemory.get(dimension)!;
    const file = this.fileFor(dimension);
    if (file && fs.existsSync(file)) {
      try {
        const arr = JSON.parse(fs.readFileSync(file, "utf-8")) as Observation[];
        this.inMemory.set(dimension, arr);
        return arr;
      } catch {
        // fall through to empty
      }
    }
    const empty: Observation[] = [];
    this.inMemory.set(dimension, empty);
    return empty;
  }

  private persist(dimension: string, observations: Observation[]): void {
    const file = this.fileFor(dimension);
    if (!file) return;
    fs.writeFileSync(file, JSON.stringify(observations, null, 2), "utf-8");
  }

  record(dimension: string, observation: Observation): number {
    const obs = this.load(dimension);
    obs.push(observation);
    this.inMemory.set(dimension, obs);
    this.persist(dimension, obs);
    return obs.length;
  }

  listDimensions(): string[] {
    const fromMemory = Array.from(this.inMemory.keys());
    if (!this.dir) return fromMemory.sort();
    const onDisk = fs.existsSync(this.dir)
      ? fs
          .readdirSync(this.dir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""))
      : [];
    return Array.from(new Set([...fromMemory, ...onDisk])).sort();
  }

  baseline(dimension: string): BaselineStats | null {
    const obs = this.load(dimension);
    if (obs.length === 0) return null;
    const values = obs.map((o) => o.value);
    return {
      dimension,
      sampleSize: obs.length,
      mean: Math.round(mean(values) * 10000) / 10000,
      stdDev: Math.round(stdDev(values) * 10000) / 10000,
      min: Math.min(...values),
      max: Math.max(...values),
      lastUpdated: obs[obs.length - 1].timestamp,
    };
  }

  check(dimension: string, observed: number): BaselineViolation | null {
    const stats = this.baseline(dimension);
    if (!stats) return null;
    if (stats.sampleSize < 3) {
      return {
        dimension,
        observed,
        expectedMean: stats.mean,
        expectedStdDev: stats.stdDev,
        sigma: 0,
        severity: "ok",
      };
    }
    const sigma = stats.stdDev > 0 ? (observed - stats.mean) / stats.stdDev : 0;
    const abs = Math.abs(sigma);
    let severity: BaselineViolation["severity"] = "ok";
    if (abs > 3) severity = "regression";
    else if (abs > 2) severity = "warning";
    return {
      dimension,
      observed,
      expectedMean: stats.mean,
      expectedStdDev: stats.stdDev,
      sigma: Math.round(sigma * 100) / 100,
      severity,
    };
  }
}
