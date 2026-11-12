// What the animation viewer can show. A subject is anything rigged with clips; the page asks of it:
//   load(status)    the body into the scene and its clips into .clips / .groups ([group, [entry]]), and .problems (what's missing)
//   model, root, wrap, bones (by name), hips, s (the body's scale: the clips' units to metres), rest (Map bone → { q, p }),
//   animated (the bones that move), feet ({ Left, Right: { heel, ball } } bones) and restFeet (their heights at rest),
//   samplers (a Map), cache ({}), meshes() (the parts drawn now)
//   entries: { name, file, C ({ clip, dur, loop, root, rootSpeed }), group, loop, fps, root (has travel), mixamo }
//   panel(el)       its own choices (looks, gear) into an element; onRebind(why) when its body or look changed
//   afterPose(dt)   anything it adds over a clip's pose (the hero's fists round a handle, his cape)
//   walk...         optional: walkBegin, walk(dt, input, camYaw, aim, stage), walkEnd, live(), action(entry, o)
// The animals (creatures/models.js) come next: each wants its rig's foot bones named and its clips listed.
import { HeroSubject } from './hero.js';

export const SUBJECTS = [
  { id: 'hero', name: 'Hero', make: (scene) => new HeroSubject(scene) },
  { id: 'deer', name: 'Deer' }, { id: 'hog', name: 'Hog' }, { id: 'fox', name: 'Fox' }, { id: 'hare', name: 'Hare' },
  { id: 'minotaur', name: 'Minotaur' }, { id: 'chimera', name: 'Chimera' },
];
