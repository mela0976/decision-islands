import type { ExplorerData, ModelPlacement, PathGraph, RoutePath, Vec3 } from './explorer-types';
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function axialToWorld(q: number, r: number, spacing = 2.28): Vec3 { return [Math.sqrt(3) * spacing * (q + r / 2), 0, 1.5 * spacing * r]; }
export function buildPathGraph(data: ExplorerData): PathGraph {
    const nodes: PathGraph['nodes'][number][] = [], edges: PathGraph['edges'][number][] = [], bridges: PathGraph['bridges'][number][] = [];
    const ringRadius = 1.8;
    for (const island of data.islands) {
        const [x, , z] = axialToWorld(...island.axial, data.layout.spacing);
        // Even indices are hex vertices. Odd indices are exact edge midpoints.
        for (let k = 0; k < 12; k++) {
            const angle = -Math.PI / 2 + k * Math.PI / 6, radius = k % 2 ? ringRadius * Math.cos(Math.PI / 6) : ringRadius;
            nodes.push({ id: `${island.id}:${k}`, islandId: island.id, position: [x + Math.cos(angle) * radius, data.layout.top + .025, z + Math.sin(angle) * radius] });
        }
        for (let k = 0; k < 12; k++) {
            const a = nodes[nodes.length - 12 + k], b = nodes[nodes.length - 12 + (k + 1) % 12];
            edges.push({ from: a.id, to: b.id, distance: distance(a.position, b.position), bridge: false });
        }
    }
    for (let i = 0; i < data.islands.length; i++)
        for (let j = i + 1; j < data.islands.length; j++) {
            const a = data.islands[i], b = data.islands[j], dq = a.axial[0] - b.axial[0], dr = a.axial[1] - b.axial[1];
            if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) !== 1)
                continue;
            const ca = axialToWorld(...a.axial, data.layout.spacing), cb = axialToWorld(...b.axial, data.layout.spacing);
            const nearest = (id: string, target: Vec3) => nodes.filter(n => n.islandId === id && Number(n.id.split(':').at(-1)) % 2 === 1).sort((a, b) => distance(a.position, target) - distance(b.position, target))[0];
            const start = nearest(a.id, cb), end = nearest(b.id, ca);
            const points: Vec3[] = Array.from({ length: 10 }, (_, k) => { const t = k / 9; return [start.position[0] + (end.position[0] - start.position[0]) * t, data.layout.top + .025 + Math.sin(t * Math.PI) * .075, start.position[2] + (end.position[2] - start.position[2]) * t]; });
            bridges.push({ id: `${a.id}~${b.id}`, from: start.id, to: end.id, points });
            edges.push({ from: start.id, to: end.id, distance: points.slice(1).reduce((sum, p, k) => sum + distance(points[k], p), 0), bridge: true });
        }
    return { nodes, edges, bridges };
}
export function findRoute(graph: PathGraph, fromIslandId: string, toIslandId: string): RoutePath {
    const start = graph.nodes.find(n => n.islandId === fromIslandId), end = graph.nodes.find(n => n.islandId === toIslandId);
    if (!start || !end)
        throw new Error('Explorer route: unknown island');
    const byId = new Map(graph.nodes.map(n => [n.id, n])), costs = new Map(graph.nodes.map(n => [n.id, Infinity])), previous = new Map<string, string>(), remaining = new Set(byId.keys());
    costs.set(start.id, 0);
    while (remaining.size) {
        let current: string | undefined, best = Infinity;
        for (const id of remaining)
            if (costs.get(id)! < best) {
                current = id;
                best = costs.get(id)!;
            }
        if (!current)
            break;
        remaining.delete(current);
        if (current === end.id)
            break;
        for (const edge of graph.edges) {
            if (!Number.isFinite(edge.distance) || edge.distance < 0)
                throw new Error('Explorer route: invalid edge weight');
            const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
            if (!next || !remaining.has(next))
                continue;
            const cost = best + edge.distance;
            if (cost < costs.get(next)!) {
                costs.set(next, cost);
                previous.set(next, current);
            }
        }
    }
    if (!Number.isFinite(costs.get(end.id)!))
        throw new Error('Explorer route: disconnected islands');
    const nodeIds = [end.id];
    while (nodeIds[0] !== start.id)
        nodeIds.unshift(previous.get(nodeIds[0])!);
    const points: Vec3[] = [start.position];
    for (let k = 1; k < nodeIds.length; k++) {
        const a = nodeIds[k - 1], b = nodeIds[k], bridge = graph.bridges.find(p => (p.from === a && p.to === b) || (p.to === a && p.from === b));
        if (bridge) {
            const middle = bridge.from === a ? [...bridge.points] : [...bridge.points].reverse();
            points.push(...middle.slice(1));
        }
        else
            points.push(byId.get(b)!.position);
    }
    const cumulative = [0];
    for (let k = 1; k < points.length; k++)
        cumulative.push(cumulative[k - 1] + distance(points[k - 1], points[k]));
    return { nodeIds, points, cumulative, length: cumulative.at(-1)! };
}
export function pointOnRoute(route: RoutePath, distanceAlong: number): {
    position: Vec3;
    heading: number;
} {
    if (!route.points.length)
        throw new Error('Explorer route: empty route');
    if (route.points.length === 1)
        return { position: route.points[0], heading: 0 };
    const d = Math.max(0, Math.min(route.length, Number.isFinite(distanceAlong) ? distanceAlong : 0));
    if (d === route.length) {
        const a = route.points.at(-2)!, b = route.points.at(-1)!;
        return { position: b, heading: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    let k = 1;
    while (k < route.cumulative.length - 1 && route.cumulative[k] < d)
        k++;
    const a = route.points[k - 1], b = route.points[k], span = route.cumulative[k] - route.cumulative[k - 1], t = span ? (d - route.cumulative[k - 1]) / span : 0;
    return { position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], heading: Math.atan2(b[0] - a[0], b[2] - a[2]) };
}
export function itemPlacements(data: ExplorerData): ModelPlacement[] {
    return data.islands.flatMap(island => {
        const [x, , z] = axialToWorld(...island.axial, data.layout.spacing), count = island.itemIds.length;
        const gap = Math.max(.46, .62 - (count - 4) * .025), positions: [
            number,
            number
        ][] = [];
        for (let row = 0; row < 5; row++)
            for (let col = -2; col <= 2; col++) {
                const px = (col + (row % 2) * .5) * gap, pz = .25 + row * gap;
                if (Math.hypot(px, pz) < 1.36)
                    positions.push([px, pz]);
            }
        positions.sort((a, b) => a[1] - b[1] || Math.abs(a[0]) - Math.abs(b[0]) || a[0] - b[0]);
        return island.itemIds.map((id, index) => { const item = data.items.find(i => i.id === id)!; const local = index === 0 ? [0, -.58] : positions[index - 1] ?? [Math.sin(index * 2.4) * 1.1, Math.cos(index * 2.4) * 1.1]; return { id, model: item.model, position: [x + local[0], data.layout.top, z + local[1]] as Vec3, scale: index === 0 ? 1.15 : .52, color: island.color }; });
    });
}
