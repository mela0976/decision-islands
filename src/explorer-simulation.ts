import type { ExplorerData, ExplorerEvent, ExplorerSimulation, PathGraph, WalkerSnapshot } from './explorer-types';
import { hashSeed, mulberry32 } from './explorer-random';
import { findRoute, pointOnRoute } from './explorer-graph';
import { activeItemIds, sampleDay } from './explorer-daycycle';
export function createSimulation(data: ExplorerData, graph: PathGraph): ExplorerSimulation {
    let minute = 600, eventId = 0, time = 0;
    const walkers = data.flows.flatMap(flow => {
        const route = findRoute(graph, flow.from, flow.to), random = mulberry32(hashSeed(data.seed, flow.id));
        return Array.from({ length: flow.walkerCount }, (_, index) => ({ id: `${flow.id}:${index}`, flow, route, distance: random() * route.length, direction: (index % 2 ? -1 : 1) as 1 | -1, speed: (data.roles.find(r => r.id === flow.role)?.accessory === 'bicycle' ? .62 : .32) + random() * .08, phase: random(), wait: 0, status: 'moving' as 'moving' | 'waiting' }));
    });
    const original = walkers.map(w => ({ distance: w.distance, direction: w.direction }));
    function update(dtSeconds: number, moving: boolean): readonly ExplorerEvent[] {
        if (!moving || !Number.isFinite(dtSeconds) || dtSeconds <= 0)
            return [];
        const events: (ExplorerEvent & {
            elapsed: number;
        })[] = [];
        const startMinute = minute;
        // Piecewise exact constant-speed traversal consumes all foreground time, including low FPS frames.
        for (const w of walkers) {
            let remaining = dtSeconds, elapsed = 0;
            const emit = (type: ExplorerEvent['type']) => { events.push({ id: 0, elapsed, type, flowId: w.flow.id, walkerId: w.id, islandId: w.direction === 1 ? w.flow.to : w.flow.from, minute: (startMinute + elapsed * 10) % 1440 }); };
            if (w.route.length <= 0)
                continue;
            while (remaining > 1e-10) {
                if (w.status === 'waiting') {
                    const step = Math.min(w.wait, remaining);
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
                    const destination = w.direction === 1 ? w.route.length : 0, needed = Math.abs(destination - w.distance) / w.speed, step = Math.min(needed, remaining);
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
                // Keep public batches bounded during intentionally huge manual advances.
                if (events.length > 200)
                    events.splice(0, events.length - 100);
            }
        }
        minute = (minute + dtSeconds * 10) % 1440;
        time += dtSeconds;
        return events.sort((a, b) => a.elapsed - b.elapsed || a.walkerId.localeCompare(b.walkerId)).slice(-100).map(({ elapsed: _elapsed, ...event }) => ({ ...event, id: ++eventId }));
    }
    return { update, setMinute(value) { if (Number.isFinite(value))
            minute = ((value % 1440) + 1440) % 1440; }, snapshot() { return { minute, day: sampleDay(data.dayKeyframes, minute), activeItemIds: activeItemIds(data, minute), walkers: walkers.map(w => { const p = pointOnRoute(w.route, w.distance); return { id: w.id, flowId: w.flow.id, role: w.flow.role, cargo: w.flow.cargo, position: p.position, heading: p.heading + (w.direction === -1 ? Math.PI : 0), phase: w.phase + time * .45, direction: w.direction, status: w.status } satisfies WalkerSnapshot; }) }; }, reset() { minute = 600; eventId = 0; time = 0; walkers.forEach((w, i) => { w.distance = original[i].distance; w.direction = original[i].direction; w.wait = 0; w.status = 'moving'; }); } };
}
