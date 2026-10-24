import * as THREE from 'three';
import { aimHand, resetContactRig } from './character-events.js';

const vector = value => new THREE.Vector3(...value);
const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const FORMS = {
  paper: ['box', '#f3dfb7'], photo: ['box', '#fff0ce'], product: ['cylinder', '#87b8aa'],
  parcel: ['box', '#bc976c'], phone: ['box', '#465e65'], radio: ['box', '#ad805d'],
  sign: ['box', '#e7cc8d'], route: ['box', '#89b0a5'], barrier: ['box', '#be826e'],
  curtain: ['box', '#b596ad'], lamp: ['cone', '#e2bd6d'], tray: ['box', '#b69b78'],
};

export function createArrivalEvents({ actors, cast, mesh, label, onCaption = () => {}, onComplete = () => {} }) {
  let event = null;
  const actorById = id => actors.find(actor => actor.id === id);
  function cancel() {
    if (!event) return false;
    for (const saved of event.actors) {
      resetContactRig(saved.actor);
      saved.actor.root.position.copy(saved.position);
      saved.actor.root.rotation.copy(saved.rotation);
      saved.actor.head.rotation.copy(saved.head);
      saved.actor.state = saved.state;
      saved.actor.expression = saved.expression;
    }
    event.group.removeFromParent();
    event = null;
    return true;
  }
  function start({ island, source = 'arrival', reducedMotion = false }) {
    cancel();
    const script = island.sceneData?.arrivalEvent;
    if (!script?.beats?.length) return false;
    const group = new THREE.Group(); group.name = script.id; island.detail.add(group);
    const props = new Map();
    for (const definition of script.props) {
      const [form, color] = FORMS[definition.kind];
      const prop = mesh(group, form, color, definition.position, definition.scale);
      prop.name = definition.id;
      prop.userData = { arrivalPropId: definition.id, kind: definition.kind, owner: null, supported: true };
      if (['paper', 'photo', 'phone', 'sign', 'radio', 'parcel'].includes(definition.kind)) {
        mesh(prop, 'box', definition.kind === 'phone' ? '#b9d3ca' : '#657e73', [0, .08, .52], [.66, .1, .035]);
        mesh(prop, 'box', '#657e73', [0, -.17, .52], [.43, .07, .035]);
      }
      if (definition.kind === 'tray') {
        const height = Math.max(.1, definition.position[1] - definition.scale[1] / 2 - 1.05);
        for (const side of [-1, 1]) mesh(group, 'box', '#826c53', [definition.position[0] + side * definition.scale[0] * .35, 1.05 + height / 2, definition.position[2]], [.08, height, .3]);
      }
      props.set(definition.id, prop);
    }
    const supported = new Set();
    function support(position, scale) {
      const key = position.join(',');
      if (supported.has(key)) return;
      supported.add(key);
      const top = position[1] - scale[1] / 2 - .06;
      const height = Math.max(.12, top - 1.05);
      mesh(group, 'box', '#c6b08c', [position[0], top, position[2]], [Math.max(.7, scale[0] + .16), .12, Math.max(.55, scale[2] + .16)]);
      for (const side of [-1, 1]) mesh(group, 'box', '#947c60', [position[0] + side * Math.max(.2, scale[0] * .35), 1.05 + height / 2, position[2]], [.07, height, .3]);
    }
    for (const definition of script.props) {
      if (['paper', 'photo', 'product', 'parcel', 'phone', 'radio'].includes(definition.kind)) support(definition.position, definition.scale);
      if (['sign', 'lamp'].includes(definition.kind)) {
        const base = definition.position[1] - definition.scale[1] / 2;
        mesh(group, 'cylinder', '#9a8b6c', [definition.position[0], (base + 1.05) / 2, definition.position[2]], [.06, Math.max(.1, base - 1.05), .06]);
      }
    }
    for (const beat of script.beats) for (const action of beat.actions) {
      if (action.type !== 'manipulate' || action.operation !== 'place') continue;
      const definition = script.props.find(prop => prop.id === action.propId);
      const tray = script.props.find(prop => prop.kind === 'tray' && Math.hypot(prop.position[0] - action.to[0], prop.position[2] - action.to[2]) < .6);
      if (!tray) support(action.to, definition.scale);
    }
    const snapshots = script.cast.map(({ actorId, position }) => {
      const actor = actorById(actorId);
      const saved = { actor, position: actor.root.position.clone(), rotation: actor.root.rotation.clone(), head: actor.head.rotation.clone(), state: actor.state, expression: actor.expression };
      resetContactRig(actor); actor.root.position.fromArray(position); actor.prop.visible = false;
      return saved;
    });
    event = { id: script.id, articleId: island.articleId, source, script, group, props, actors: snapshots, elapsed: 0, beatIndex: -1, phase: 'cause', complete: false, skipped: false, history: [], owners: new Map(), crowd: null };
    update(0);
    if (reducedMotion) skip();
    return true;
  }
  function enterBeat(index) {
    const e = event, beat = e.script.beats[index];
    e.beatIndex = index; e.phase = beat.id; e.caption = beat.caption;
    e.history.push(beat.id);
    e.starts = new Map();
    for (const action of beat.actions) {
      const object = action.type === 'walk' ? actorById(action.actorId)?.root : e.props.get(action.propId);
      if (object) e.starts.set(action, { position: object.position.clone(), rotation: object.rotation.clone(), actorPosition: actorById(action.actorId)?.root.position.clone(), owner: object.userData.owner || null });
    }
    onCaption(beat.caption, { id: e.id, articleId: e.articleId, phase: e.phase, complete: false, source: e.source });
  }
  function face(actor, target) {
    if (!actor || !target) return;
    const destination = target.getWorldPosition(new THREE.Vector3());
    const origin = actor.root.getWorldPosition(new THREE.Vector3());
    actor.root.rotation.y = Math.atan2(destination.x - origin.x, destination.z - origin.z);
    actor.root.updateWorldMatrix(true, true); actor.head.lookAt(destination);
  }
  function pose(beat, progress) {
    const e = event, t = smooth(progress);
    for (const action of beat.actions) {
      const actor = actorById(action.actorId), prop = e.props.get(action.propId), from = e.starts.get(action);
      if (action.type === 'walk' && actor) {
        actor.root.position.lerpVectors(from.position, vector(action.to), t);
        const delta = vector(action.to).sub(from.position);
        if (delta.lengthSq() > .001) actor.root.rotation.y = Math.atan2(delta.x, delta.z);
        actor.legs.forEach((leg, index) => { leg.rotation.x = progress === 1 ? 0 : Math.sin(progress * (action.gait === 'hesitate' ? 7 : 15) + index * Math.PI) * .35; });
      } else if (action.type === 'look') {
        face(actor, action.target.actorId ? actorById(action.target.actorId)?.head : e.props.get(action.target.propId));
      } else if (action.type === 'gesture' && actor) {
        actor.expression = ['hesitate', 'pen-stop'].includes(action.gesture) ? 'concerned' : 'thoughtful';
        actor.head.rotation.z = (action.gesture === 'remember' ? -.18 : .12) * Math.sin(t * Math.PI / 2);
        actor.arms[1].rotation.x = -(.35 + .65 * t);
        actor.brows.forEach((brow, index) => { brow.rotation.z = (index ? -1 : 1) * .18 * t; });
        actor.mouth.scale.y = action.gesture === 'sing' ? .07 : .018;
      } else if ((action.type === 'manipulate' || action.type === 'exchange') && prop) {
        const approach = action.type === 'manipulate' && !from.owner ? .3 : 0;
        const carrying = smooth((progress - approach) / (1 - approach));
        prop.position.lerpVectors(from.position, vector(action.to), carrying);
        if (action.type === 'manipulate') {
          const beside = position => vector([position.x - .4, from.actorPosition.y, position.z - .5]);
          const approachPosition = beside(from.position);
          if (approach && progress < approach) {
            actor.root.position.lerpVectors(from.actorPosition, approachPosition, smooth(progress / approach));
            actor.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(progress * 35 + index * Math.PI) * .28; });
            actor.root.updateWorldMatrix(true, true);
            const neutral = actor.root.localToWorld(new THREE.Vector3(.34, .43, 0));
            const target = prop.getWorldPosition(new THREE.Vector3());
            actor.hands[1].forearm.visible = true;
            aimHand(actor, 1, neutral.lerp(target, smooth(progress / approach)));
          } else {
            actor.root.position.lerpVectors(from.owner ? from.actorPosition : approachPosition, beside(vector(action.to)), carrying);
            actor.legs.forEach((leg, index) => { leg.rotation.x = progress < 1 ? Math.sin(progress * 22 + index * Math.PI) * .2 : 0; });
          }
          if (action.operation === 'flip') prop.rotation.y = from.rotation.y + Math.PI * carrying;
        }
        const owner = action.type === 'exchange' ? (progress < .5 ? action.actorId : action.receiverId) : progress < approach || action.operation === 'place' && progress >= 1 ? null : action.actorId;
        e.owners.set(action.propId, owner); prop.userData.owner = owner; prop.userData.supported = owner === null;
      } else if (action.type === 'transform' && prop) {
        prop.position.lerpVectors(from.position, vector(action.to), t);
        if (action.rotation) prop.rotation.set(...from.rotation.toArray().slice(0, 3).map((v, index) => THREE.MathUtils.lerp(v, action.rotation[index], t)));
      } else if (action.type === 'crowd') {
        if (!e.crowd) {
          e.crowd = new THREE.Group(); e.group.add(e.crowd);
          for (let index = 0; index < action.count; index++) {
            const person = new THREE.Group(); e.crowd.add(person);
            mesh(person, 'cylinder', ['#b6898b', '#8d9b5b', '#5d8995'][index % 3], [0, .5, 0], [.23, .8, .2]);
            mesh(person, 'ball', '#d4b397', [0, 1.1, 0], [.23, .25, .22]);
            for (const side of [-1, 1]) mesh(person, 'box', '#d4b397', [side * .3, .7, 0], [.08, .5, .08]);
          }
        }
        const target = e.props.get(action.targetPropId).position;
        e.crowd.children.forEach((person, index) => {
          const angle = -.9 + index * 1.8 / Math.max(1, action.count - 1);
          person.position.set(target.x + Math.sin(angle) * 2, 1.1 + (action.mode === 'sing' ? Math.sin(e.elapsed * 4 + index) * .07 : 0), target.z + 2 + Math.cos(angle));
          person.rotation.y = Math.PI + angle;
          person.children.slice(2).forEach((arm, i) => { arm.rotation.z = action.mode === 'sing' ? (i ? -1 : 1) * .8 : .1; });
        });
      }
    }
    cast.updateWorldMatrix(true, true); e.group.updateWorldMatrix(true, true);
    for (const [id, owner] of e.owners) {
      if (!owner) continue;
      const actor = actorById(owner), prop = e.props.get(id);
      actor.hands[1].forearm.visible = true;
      const target = prop.getWorldPosition(new THREE.Vector3());
      aimHand(actor, 1, target);
      prop.updateWorldMatrix(true, true);
      prop.userData.contactDistance = prop.getWorldPosition(new THREE.Vector3()).distanceTo(actor.hands[1].palm.getWorldPosition(new THREE.Vector3()));
    }
    for (const saved of e.actors) saved.actor.state = `arrival-${e.phase}`;
  }
  function update(dt) {
    if (!event || event.complete) return;
    const e = event, total = e.script.beats.reduce((sum, beat) => sum + beat.duration, 0);
    e.elapsed = Math.min(total, e.elapsed + Math.max(0, dt));
    let offset = 0;
    for (let index = 0; index < e.script.beats.length; index++) {
      const beat = e.script.beats[index];
      if (index > e.beatIndex) enterBeat(index);
      if (index === e.beatIndex) pose(beat, Math.min(1, (e.elapsed - offset) / beat.duration));
      offset += beat.duration;
      if (e.elapsed < offset) break;
    }
    if (e.elapsed >= total) {
      e.complete = true;
      onCaption(e.script.beats.at(-1).caption, { id: e.id, articleId: e.articleId, phase: 'reaction', complete: true, source: e.source, question: e.script.handoff.question });
      onComplete({ articleId: e.articleId, source: e.source });
    }
  }
  function skip() { if (!event || event.complete) return false; event.skipped = true; update(100); return true; }
  return {
    start, update, cancel, skip,
    hasParticipant(id) { return Boolean(event?.actors.some(saved => saved.actor.id === id)); },
    state() { return event ? { id: event.id, articleId: event.articleId, source: event.source, phase: event.phase, elapsed: event.elapsed, complete: event.complete, skipped: event.skipped, history: [...event.history], caption: event.caption, participants: event.actors.map(({ actor }) => ({ actorId: actor.id, position: actor.root.position.toArray(), rotation: actor.root.rotation.toArray().slice(0, 3) })), props: [...event.props].map(([id, prop]) => ({ id, kind: prop.userData.kind, position: prop.position.toArray(), rotation: prop.rotation.toArray().slice(0, 3), owner: prop.userData.owner, supported: prop.userData.supported, contactDistance: prop.userData.contactDistance ?? null })), crowdCount: event.crowd?.children.length || 0 } : null; },
  };
}
