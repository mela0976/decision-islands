import type { ExplorerData, ExplorerNpc } from './explorer-types';

export function clampNpcPopulation(value: number): number {
  return Number.isFinite(value) ? Math.max(10, Math.min(100, Math.round(value))) : 30;
}

export function createNpcRoster(data: ExplorerData, population: number): readonly ExplorerNpc[] {
  if (!data.islands.length) return [];
  return Array.from({ length: clampNpcPopulation(population) }, (_, index) => {
    const flow = data.flows[index % data.flows.length];
    const island = data.islands[index % data.islands.length];
    const article = data.articles[index % data.articles.length];
    return {
      id: flow ? `${flow.id}:${Math.floor(index / data.flows.length)}` : `${data.year}-reader:${index}`,
      roleId: flow?.role ?? data.roles[index % data.roles.length]?.id ?? 'reader',
      flowId: flow?.id ?? null,
      homeIslandId: flow?.from ?? island.id,
      articleIds: article ? [article.id] : [],
    };
  });
}
