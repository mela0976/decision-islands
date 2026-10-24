import * as THREE from 'three';

const PHASES = [['approach', 1.2], ['contact', .8], ['hold', 1.2], ['release', 1.2], ['react', 1.3]];
const DURATION = PHASES.reduce((sum, [, duration]) => sum + duration, 0);
const ACTIONS = {
  stack: 'place', center: 'place', present: 'inspect', place: 'place', face: 'inspect',
  pair: 'compare', compare: 'compare', opposite: 'compare', shield: 'inspect', connect: 'place',
  flip: 'flip', reveal: 'flip', turn: 'turn', exchange: 'exchange', handoff: 'exchange',
  gather: 'gather', 'line-up': 'place', pause: 'place', photo: 'inspect', front: 'place',
  sing: 'sing', listen: 'listen', retell: 'inspect', open: 'flip', pass: 'pass', linger: 'listen',
  move: 'place', empty: 'inspect', clear: 'place', assist: 'exchange', surface: 'flip', split: 'compare',
  deliver: 'place', foreground: 'inspect', spread: 'place',
};
const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const vec = (x, y, z) => new THREE.Vector3(x, y, z);

export function addContactRig(actor, mesh) {
  actor.hands = [-1, 1].map(side => {
    const palm = mesh(actor.root, 'ball', actor.skin, [side * .34, .43, 0], [.09, .09, .09]);
    const forearm = mesh(actor.root, 'cylinder', actor.color, [side * .34, .58, 0], [.075, .34, .075]);
    const grip = new THREE.Object3D(); palm.add(grip);
    forearm.visible = false;
    return { palm, forearm, grip, side };
  });
}

export function aimHand(actor, handIndex, worldTarget) {
  const hand = actor.hands[handIndex];
  actor.root.updateWorldMatrix(true, false);
  const target = actor.root.worldToLocal(worldTarget.clone());
  const shoulder = vec(hand.side * .34, 1, 0);
  const direction = target.clone().sub(shoulder);
  const distance = direction.length();
  direction.normalize();
  const length = .56;
  const reach = Math.min(distance, length * 2 - .001);
  const end = shoulder.clone().addScaledVector(direction, reach);
  const bend = vec(0, 0, 1).addScaledVector(direction, -direction.z).normalize();
  const elbow = shoulder.clone().addScaledVector(direction, reach / 2).addScaledVector(bend, Math.sqrt(length * length - reach * reach / 4));
  const segment = (object, from, to, radius) => {
    object.position.copy(from).add(to).multiplyScalar(.5);
    object.scale.set(radius, from.distanceTo(to), radius);
    object.quaternion.setFromUnitVectors(vec(0, 1, 0), to.clone().sub(from).normalize());
  };
  segment(actor.arms[handIndex], shoulder, elbow, .08);
  segment(hand.forearm, elbow, end, .075);
  hand.palm.position.copy(end);
  actor.root.updateWorldMatrix(true, true);
}

export function createCharacterEvents({ actors, cast, mesh, onStart, onReaction }) {
  let event = null;
  const actorById = id => actors.find(actor => actor.id === id);
  const worldPoint = local => cast.localToWorld(local.clone());
  const face = (actor, target) => {
    const from = actor.root.getWorldPosition(new THREE.Vector3());
    actor.root.rotation.y = Math.atan2(target.x - from.x, target.z - from.z);
    actor.root.updateWorldMatrix(true, true);
    actor.head.lookAt(target);
  };
  const resetRig = actor => {
    actor.hands.forEach((hand, i) => {
      hand.palm.position.set(hand.side * .34, .43, 0);
      hand.forearm.visible = false;
      actor.arms[i].position.set(hand.side * .34, .75, 0);
      actor.arms[i].scale.set(.08, .65, .08);
      actor.arms[i].rotation.set(0, 0, 0);
    });
    actor.prop.visible = true;
  };
  function cancel() {
    if (event) for (const id of event.participantIds) { const actor = actorById(id); if (actor) resetRig(actor); }
    event = null;
  }
  function start({ island, effect, prop, starts, reducedMotion = false, purchase = false }) {
    cancel();
    const actor = purchase ? actors.find(actor => actor.habit === 'phone') : actorById(effect.actorId);
    if (!actor || !prop || !ACTIONS[effect.action]) return false;
    const partner = island.canonical === 'A01' ? actors.find(actor => actor.habit === 'phone') : actorById(island.sceneData?.characterIds?.find(id => id !== actor.id)) || actors.find(other => other !== actor);
    const mode = purchase ? 'purchase' : ACTIONS[effect.action];
    const receiver = partner && partner !== actor ? partner : actors.find(other => other !== actor);
    const start = vec(-.85, 1.1, 4.9), other = vec(.85, 1.1, 4.9);
    const support = vec(0, 1.85, 4.9);
    const transfer = mode === 'exchange';
    const source = island.canonical === 'A01' && transfer ? receiver : actor;
    const destination = island.canonical === 'A01' && transfer ? actor : receiver;
    const participants = [actor, receiver];
    const gripSide = source === actor ? -1 : 1;
    const grip = new THREE.Object3D(); grip.position.set(gripSide * .5, 0, 0); prop.add(grip);
    const receiveGrip = new THREE.Object3D(); receiveGrip.position.set(-gripSide * .5, 0, 0); prop.add(receiveGrip);
    if (transfer) {
      mesh(prop, 'box', '#365e59', [0, .26, .52], [.7, .09, .035]);
      mesh(prop, 'box', '#365e59', [0, -.22, .52], [.48, .07, .035]);
    }
    const rest = prop.position.clone();
    const stationary = ['sing', 'listen', 'gather', 'pass'].includes(mode);
    const surface = stationary ? null : mesh(island.outcome, 'box', '#b99d7c', [support.x, support.y - .09 - prop.scale.y / 2, support.z], [1.65, .18, 1.1]);
    if (surface) surface.userData.contactSupport = effect.id;
    if (!stationary) { prop.position.copy(support); prop.rotation.set(0, 0, 0); }
    event = { articleId: island.articleId, effectId: effect.id, action: effect.action, mode, elapsed: 0, phase: 'approach', owner: null, actor, receiver, source, destination, prop, grip, receiveGrip, rest, support, surface, starts, targets: new Map([[actor.id, start], [receiver.id, other]]), participantIds: participants.map(a => a.id), reactionSent: false, complete: false, stationary };
    for (const person of participants) { person.prop.visible = false; person.hands.forEach(hand => hand.forearm.visible = true); person.root.position.copy(starts.get(person.id) || person.root.position); }
    onStart(island.canonical === 'A01' ? '顧客帶著單據走回服務窗口。' : mode === 'purchase' ? '小岳停在貨架前，伸手比較今天要用的商品。' : mode === 'exchange' ? '兩人停步，把應援卡放在彼此之間。' : island.sceneData?.dialogue?.[0]?.text || '先走近，看清楚眼前的線索。');
    update(0, reducedMotion);
    return true;
  }
  function update(dt, reducedMotion = false) {
    if (!event) return;
    const e = event;
    e.elapsed = reducedMotion ? DURATION : Math.min(DURATION, e.elapsed + dt);
    let offset = 0;
    for (const [phase, duration] of PHASES) {
      e.phase = phase;
      if (e.elapsed < offset + duration || phase === 'react') break;
      offset += duration;
    }
    const t = e.elapsed;
    const approach = smooth(t / 1.2);
    for (const person of [e.actor, e.receiver]) {
      person.root.position.lerpVectors(e.starts.get(person.id) || e.targets.get(person.id), e.targets.get(person.id), approach);
      person.state = `event-${e.phase}`;
      person.legs.forEach((leg, index) => leg.rotation.x = t < 1.2 ? Math.sin(t * 10 + index * Math.PI) * .3 : 0);
    }
    cast.updateWorldMatrix(true, true);
    face(e.actor, e.receiver.head.getWorldPosition(new THREE.Vector3()));
    face(e.receiver, e.actor.head.getWorldPosition(new THREE.Vector3()));
    const held = vec(0, 2.55, 4.9);
    const release = smooth((t - 3.2) / 1.2);
    const pickup = smooth((t - 1.2) / .8);
    e.prop.position.lerpVectors(e.support, held, pickup);
    if (t >= 3.2) e.prop.position.lerpVectors(held, e.support, release);
    if (e.mode === 'flip') e.prop.rotation.y = Math.PI * pickup;
    if (e.mode === 'turn') e.prop.rotation.y = .7 * pickup;
    if (e.mode === 'compare') e.prop.rotation.z = .18 * Math.sin(pickup * Math.PI) * (1 - release);
    if (e.mode === 'inspect' || e.mode === 'purchase') e.prop.rotation.x = -.22 * pickup * (1 - release);
    e.owner = t < 1.2 || t >= 4.4 ? null : e.mode === 'exchange' && t >= 2.6 ? e.destination.id : e.source.id;
    e.prop.userData.owner = e.owner;
    e.prop.userData.supported = e.owner === null;
    e.prop.updateWorldMatrix(true, true);
    const sourceTarget = e.grip.getWorldPosition(new THREE.Vector3());
    const receiveTarget = e.receiveGrip.getWorldPosition(new THREE.Vector3());
    const neutral = person => person.root.localToWorld(vec(.34, .43, 0));
    const reach = smooth(t / 1.2);
    const withdraw = smooth((t - 4.4) / .5);
    for (const person of [e.actor, e.receiver]) {
      const involved = !e.stationary && (person === e.source || e.mode === 'exchange');
      const point = person === e.source ? sourceTarget : receiveTarget;
      const relaxed = neutral(person);
      const target = relaxed.clone().lerp(point, involved ? reach * (1 - withdraw) : 0);
      aimHand(person, 1, target);
      aimHand(person, 0, person.root.localToWorld(vec(-.34, .43, 0)));
      person.mouth.scale.x = e.phase === 'react' && person === e.receiver ? .14 : .08;
    }
    if (['sing', 'listen', 'gather', 'pass'].includes(e.mode)) {
      e.prop.position.copy(e.rest); e.prop.rotation.set(0, 0, 0); e.owner = null; e.prop.userData.owner = null; e.prop.userData.supported = true;
      for (const person of [e.actor, e.receiver]) {
        if (e.mode === 'pass') person.root.position.x += smooth((t - 1.2) / 4.5) * 2.6;
        else if (t >= 2) { face(person, worldPoint(vec(0, 3, -1.25))); person.mouth.scale.x = e.mode === 'sing' ? .16 + Math.sin(t * 5) * .03 : .08; }
      }
    }
    if (e.phase === 'react' && !e.reactionSent) { e.reactionSent = true; onReaction(e.effectId); }
    e.complete = t >= DURATION;
  }
  function state() {
    if (!event) return null;
    const e = event;
    cast.updateWorldMatrix(true, true);
    const point = object => object.getWorldPosition(new THREE.Vector3());
    return { articleId: e.articleId, effectId: e.effectId, action: e.action, mode: e.mode, phase: e.phase, elapsed: e.elapsed, duration: DURATION, complete: e.complete, owner: e.owner, ownerCount: e.owner ? 1 : 0, supported: e.prop.userData.supported, propPosition: point(e.prop).toArray(), supportPosition: worldPoint(e.support).toArray(), grips: [point(e.grip).toArray(), point(e.receiveGrip).toArray()], participants: [e.source, e.destination].map((actor, i) => { const head = point(actor.head), other = point((actor === e.actor ? e.receiver : e.actor).head), forward = vec(0, 0, 1).applyQuaternion(actor.head.getWorldQuaternion(new THREE.Quaternion())); const palm = point(actor.hands[1].grip); return { id: actor.id, hand: palm.toArray(), head: head.toArray(), headWidth: .58 * 1.4, gripDistance: palm.distanceTo(point(i === 0 ? e.grip : e.receiveGrip)), gazeAlignment: forward.dot(other.sub(head).normalize()) }; }) };
  }
  return { start, update, cancel, state, hasEvent: () => Boolean(event), hasParticipant: id => Boolean(event?.participantIds.includes(id)) };
}

export function resetContactRig(actor) {
  actor.hands.forEach((hand, index) => {
    hand.palm.position.set(hand.side * .34, .43, 0);
    hand.forearm.visible = false;
    actor.arms[index].position.set(hand.side * .34, .75, 0);
    actor.arms[index].scale.set(.08, .65, .08);
    actor.arms[index].rotation.set(0, 0, 0);
  });
  actor.legs.forEach(leg => { leg.rotation.x = 0; });
  actor.brows.forEach(brow => { brow.rotation.z = 0; });
  actor.mouth.scale.set(.09, .018, .02);
  actor.prop.visible = true;
}
