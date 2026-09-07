export interface Csr {
  /** offsets.length === n + 1; row i is targets[offsets[i] .. offsets[i+1]) */
  offsets: number[];
  targets: number[];
}

export type EdgeKind = 'runtime' | 'dev' | 'native';
export const EDGE_KINDS: EdgeKind[] = ['runtime', 'dev', 'native'];

export interface GraphFile {
  version: 1;
  generatedAt: string;
  source: string;
  ids: string[];
  desc: string[];
  tags: number[];
  runtime: Csr;
  dev: Csr;
  native: Csr;
}

export interface PackageInput {
  id: string;
  desc: string;
  tags: number;
  runtime: Iterable<string>;
  dev: Iterable<string>;
  native: Iterable<string>;
}
