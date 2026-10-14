import { ARRAY_TUTORIALS } from './arrays';
import { GRAPH_DP_TUTORIALS } from './graph-dp';
import { GRAPH_TUTORIALS } from './graphs';
import { NODE_TUTORIALS } from './nodes';
import { STRUCTURE_TUTORIALS } from './structures';
import { TECHNIQUE_TUTORIALS } from './techniques';
import type { Example, Tutorial } from './types';

export * from './types';

export const TUTORIALS: Tutorial[] = [
  ...ARRAY_TUTORIALS,
  ...STRUCTURE_TUTORIALS,
  ...NODE_TUTORIALS,
  ...GRAPH_TUTORIALS,
  ...GRAPH_DP_TUTORIALS,
  ...TECHNIQUE_TUTORIALS,
];

const tutorialById = new Map(TUTORIALS.map((t) => [t.id, t]));
const exampleIndex = new Map<string, { example: Example; tutorial: Tutorial }>();
for (const tutorial of TUTORIALS) for (const example of tutorial.examples) exampleIndex.set(example.id, { example, tutorial });

export const getTutorial = (id: string | undefined) => (id ? tutorialById.get(id) : undefined);
export const getExample = (id: string | undefined) => (id ? exampleIndex.get(id) : undefined);

/** 第一次開啟網站時預設打開的頁籤 */
export const DEFAULT_EXAMPLE_IDS = ['lc167', 'lc283', 'lc1'];
