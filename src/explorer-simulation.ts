import type { ExplorerData, ExplorerEvent, ExplorerSimulation, PathGraph, RoutePath, WalkerSnapshot } from './explorer-types';
import { hashSeed, mulberry32 } from './explorer-random';
import { findRoute, pointOnRoute } from './explorer-graph';
import { createNpcRoster } from './explorer-npcs';
import { activeItemIds, sampleDay } from './explorer-daycycle';
export function createSimulation(data: ExplorerData, graph: PathGraph, population = 30): ExplorerSimulation {
    let minute = 600, eventId = 0, time = 0;
    let encounter: string | null = null;
    const routes = new Map<string, RoutePath>();
    function localRoute(islandId: string): RoutePath {
        const nodes = graph.nodes.filter(n => n.islandId === islandId);
        const points = [...nodes.map(n => n.position), nodes[0].position];
        const cumulative = [0];
        for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(...points[i].map((v, k) => v - points[i - 1][k])));
        return { nodeIds: nodes.map(n => n.id), points, cumulative, length: cumulative.at(-1)! };
    }
    function makeWalker(npc: ReturnType<typeof createNpcRoster>[number]) {
        const flow = data.flows.find(f => f.id === npc.flowId);
        const routeKey = flow?.id ?? npc.homeIslandId;
        let route = routes.get(routeKey);
        if (!route) { route = flow ? findRoute(graph, flow.from, flow.to) : localRoute(npc.homeIslandId); routes.set(routeKey, route); }
        const random = mulberry32(hashSeed(data.seed, npc.id));
        const distance = random() * route.length, direction = (random() > .5 ? -1 : 1) as 1 | -1;
        const speed = (data.roles.find(r => r.id === npc.roleId)?.accessory === 'bicycle' ? .62 : .32) + random() * .08;
        return { id: npc.id, role: npc.roleId, flow, route, distance, direction, speed, phase: random(), clock: time, wait: 0, status: 'moving' as 'moving' | 'waiting', original: { distance, direction } };
    }
    let walkers: ReturnType<typeof makeWalker>[] = [];
    function setPopulation(count: number) {
        const previous = new Map(walkers.map(w => [w.id, w]));
        walkers = createNpcRoster(data, count).map(npc => previous.get(npc.id) ?? makeWalker(npc));
        if (!walkers.some(w => w.id === encounter)) encounter = null;
    }
    setPopulation(population);
    function update(dtSeconds: number, moving: boolean): readonly ExplorerEvent[] {
        if (!moving || !Number.isFinite(dtSeconds) || dtSeconds <= 0)
            return [];
        const events: (ExplorerEvent & {
            elapsed: number;
        })[] = [];
        const startMinute = minute;
        for (const w of walkers) {
            if (w.id === encounter) continue;
            w.clock += dtSeconds;
            let remaining = dtSeconds, elapsed = 0;
            const emit = (type: ExplorerEvent['type']) => { if (!w.flow) return; events.push({ id: 0, elapsed, type, flowId: w.flow.id, walkerId: w.id, islandId: w.direction === 1 ? w.flow.to : w.flow.from, minute: (startMinute + elapsed * 10) % 1440 }); };
            if (w.route.length <= 0)
                continue;
            while (remaining > 1e-10) {
                if (w.status === 'waiting') {
                    const step = Math.min(w.wait, remaining, .08);
                    w.wait -= step;
                    remaining -= step;
                    elapsed += step;
                    if (w.wait <= 1e-10) {
                        emit('handoff');
                        emit('depart');
                        w.direction = w.direction === 1 ? -1 : 1;
                        w.status = 'moving';
                    }
                }
                else {
                    const destination = w.direction === 1 ? w.route.length : 0, needed = Math.abs(destination - w.distance) / w.speed, step = Math.min(needed, remaining, .08);
                    w.distance += w.direction * w.speed * step;
                    remaining -= step;
                    elapsed += step;
                    if (step >= needed - 1e-10) {
                        w.distance = destination;
                        w.status = 'waiting';
                        w.wait = 1.4;
                        emit('arrive');
                    }
                }
                if (events.length > 200)
                    events.splice(0, events.length - 100);
            }
        }
        minute = (minute + dtSeconds * 10) % 1440;
        time += dtSeconds;
        return events.sort((a, b) => a.elapsed - b.elapsed || a.walkerId.localeCompare(b.walkerId)).slice(-100).map(({ elapsed: _elapsed, ...event }) => ({ ...event, id: ++eventId }));
    }
    return { update, setPopulation, setEncounter(id) { encounter = typeof id === 'string' && walkers.some(w => w.id === id) ? id : null; }, setMinute(value) { if (Number.isFinite(value))
            minute = ((value % 1440) + 1440) % 1440; }, snapshot() { return { minute, day: sampleDay(data.dayKeyframes, minute), activeItemIds: activeItemIds(data, minute), walkers: walkers.map(w => { const p = pointOnRoute(w.route, w.distance); return { id: w.id, flowId: w.flow?.id ?? '', role: w.role, cargo: w.flow?.cargo ?? 'book', position: p.position, heading: p.heading + (w.direction === -1 ? Math.PI : 0), phase: w.phase + w.clock * w.speed * 1.4, direction: w.direction, status: w.id === encounter ? 'talking' : w.status } satisfies WalkerSnapshot; }) }; }, reset() { minute = 600; eventId = 0; time = 0; encounter = null; walkers.forEach(w => { w.distance = w.original.distance; w.direction = w.original.direction; w.clock = 0; w.wait = 0; w.status = 'moving'; }); } };
}
