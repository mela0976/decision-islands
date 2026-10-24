import type { MissionStage, MissionStageInput, MissionSetting, MissionPropKind, MissionSceneEntity } from './mission-stage-types';
import './mission-stage.css';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
const palettes: Record<MissionSetting, [string, string, string]> = {
  home: ['#e8d8c6', '#cbb295', '#b76d52'], community: ['#dce7d1', '#a6bd9b', '#638d73'],
  office: ['#dce6ec', '#abbcc8', '#537c97'], commute: ['#d5e8e8', '#a3c3c5', '#cc8754'],
  'brand-studio': ['#f0dada', '#d6b1ad', '#ab5969'], meeting: ['#e4e1d0', '#c4bfa2', '#6e887c'],
  production: ['#d9dce6', '#999fb5', '#85749b'], 'insight-lab': ['#d6e5e9', '#a1bec8', '#548e9a'],
};
const rect = (x: number, y: number, w: number, h: number, fill: string, r = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const line = (x: number,y: number,x2: number,y2: number, stroke = '#52605f', width = 3) => `<path d="M${x} ${y}L${x2} ${y2}" stroke="${stroke}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
const windowArt = (x: number, y: number, w = 100, h = 85) => `${rect(x,y,w,h,'#faf9ef',5)}${rect(x+6,y+6,w-12,h-12,'#c2dde1')}<path d="M${x+6} ${y+h-8}l25 -30 25 17 30 -36v49" fill="#a1bda8"/>${line(x+w/2,y+4,x+w/2,y+h-4,'#faf9ef',5)}${line(x+3,y+h/2,x+w-3,y+h/2,'#faf9ef',5)}`;
const plant = (x: number, y: number) => `<path d="M${x} ${y}v-44m0 22q-38 -2 -26 -27 26 -2 26 27m0 -8q32 -5 27 -30 -29 0 -27 30" fill="#799c7f" stroke="#557d64" stroke-width="2"/><path d="M${x-17} ${y-3}h34l-5 29h-24z" fill="#c8876c"/>`;
const desk = (x: number,y: number,w = 135) => `<path d="M${x} ${y}l22 -15h${w}l-22 15z" fill="#e7c6a0"/><path d="M${x} ${y}h${w}v9H${x}z" fill="#b98f6e"/>${line(x+10,y+9,x+10,y+57,'#8e7968',6)}${line(x+w-12,y+9,x+w-12,y+57,'#8e7968',6)}`;
const shelf = (x: number,y: number) => `${rect(x,y,94,85,'#b58f70')}${rect(x+6,y+5,82,33,'#e7d9c4')}${rect(x+6,y+44,82,34,'#e7d9c4')}${[0,1,2,3,4].map(i=>rect(x+12+i*13,y+13,9,24,['#6f9096','#c27e67','#e5bd65'][i%3])).join('')}${rect(x+17,y+54,55,8,'#8ba78c')}${rect(x+24,y+63,56,8,'#d59c7c')}`;

function room(setting: MissionSetting): string {
  const [wall, floor, accent] = palettes[setting];
  const shell = `<ellipse cx="365" cy="335" rx="303" ry="17" fill="#374943" opacity=".10"/><path d="M45 73L570 38 684 107V285L158 329 45 257z" fill="${wall}"/><path d="M45 73l113 67v189L45 257z" fill="${accent}" opacity=".18"/><path d="M158 215l526 -35v105L158 329 45 257 45 196z" fill="${floor}"/><path d="M158 215v114M158 215L45 146M158 215l526 -35" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="2"/><path d="M45 257l113 72 526 -44v8l-526 45 -113 -72z" fill="${accent}" opacity=".36"/>`;
  const details: Record<MissionSetting,string> = {
    home: `${windowArt(420,65,148,95)}${shelf(191,102)}<path d="M320 224l177 -13 55 34 -174 18z" fill="#d5a590" opacity=".55"/>${rect(352,168,133,56,'#a97763',12)}${rect(337,190,162,39,'#c5937b',10)}${rect(342,177,28,42,'#d1a88f',8)}${rect(469,172,24,43,'#d1a88f',8)}${rect(380,179,36,23,'#efe1bd',6)}${desk(258,249,101)}${plant(594,208)}`,
    community: `${windowArt(458,66,128,87)}${shelf(193,104)}${desk(331,212,163)}${rect(300,77,110,79,'#f8f0d9')}${line(311,99,394,99,'#b7ad8e',2)}<path d="M317 138l19 -24 19 15 25 -32 17 40" fill="#a4bd90"/>${rect(563,204,38,12,'#b68c6c')}${line(570,216,570,242,'#827568',5)}${line(594,216,594,239,'#827568',5)}${plant(617,207)}`,
    office: `${windowArt(468,64,135,93)}${desk(207,220,150)}${desk(421,203,130)}${rect(254,146,69,48,'#526e7d')}${rect(259,151,59,35,'#d3e3e6')}${line(286,193,286,206,'#526e7d',5)}${rect(268,204,38,5,'#526e7d')}${rect(363,84,72,65,'#f7f2e1')}${[0,1,2].map(i=>rect(372,95+i*15,50-i*10,5,'#9ab0b5')).join('')}${plant(605,212)}`,
    commute: `${rect(183,62,441,131,'#799da3',6)}${rect(191,70,425,108,'#dcebec',3)}${[0,1,2,3].map(i=>`${rect(204+i*99,84,73,65,'#91b7be')}${rect(211+i*99,90,59,42,'#c6dfe1')}`).join('')}${line(183,181,625,181,'#e9d3a0',8)}${line(172,242,655,211,'#f1d58f',5)}${rect(57,106,85,82,'#f2e4cc')}${rect(59,105,81,20,'#c77c5c')}${rect(67,133,25,40,'#9db6b7')}${rect(101,133,29,40,'#d6bb91')}${rect(329,59,105,24,'#4a6871')}${line(339,70,373,70,'#f4f1d9',3)}${line(386,70,423,70,'#f4f1d9',3)}`,
    'brand-studio': `${rect(201,77,275,100,'#faf0e5')}${rect(211,87,76,79,'#c56e7d')}${rect(299,88,68,35,'#e1bd81')}${rect(379,89,85,35,'#9bafaf')}${rect(299,133,92,30,'#bfb2ca')}${rect(401,135,61,28,'#e8c3ae')}${desk(345,226,163)}${rect(407,173,27,40,'#f3e0b1',4)}${rect(413,164,15,11,'#8c7270',2)}${rect(456,189,31,24,'#c9868c',3)}${shelf(538,121)}${plant(594,220)}`,
    meeting: `${rect(241,68,270,102,'#fcfaf0')}${line(269,140,311,111,'#789c89',5)}${line(311,111,353,125,'#789c89',5)}${line(353,125,405,93,'#789c89',5)}${rect(435,86,55,8,'#ceb687')}${rect(435,103,43,8,'#b5c5b1')}${desk(266,242,266)}${[233,535].map(x=>`${rect(x,196,33,42,'#718a80',9)}${line(x+7,234,x+7,265,'#66756c',4)}${line(x+28,234,x+28,265,'#66756c',4)}`).join('')}${plant(600,204)}`,
    production: `<path d="M292 74h247v155H292z" fill="#a2a9ba"/><path d="M305 74v113q0 33 35 39h200V74" fill="#d0d3df"/>${line(211,117,211,262,'#48515e',5)}${line(211,241,183,274,'#48515e',4)}${line(211,241,238,268,'#48515e',4)}<path d="M169 88l75 -11 14 57 -76 10z" fill="#414c5d"/><path d="M178 95l59 -9 11 39 -59 10z" fill="#fff0c5"/>${line(579,116,579,247,'#48515e',5)}<path d="M548 85l64 5 -4 49 -64 -5z" fill="#414c5d"/>${rect(551,92,53,38,'#fff0c5')}${desk(68,226,68)}`,
    'insight-lab': `${windowArt(501,63,113,86)}${rect(219,72,246,107,'#f5f6ed')}${[0,1,2,3,4].map(i=>rect(235+i*41,151-i*12,24,16+i*12,['#84aaa8','#adbd97','#d8b779'][i%3])).join('')}${line(232,161,449,161,'#8dabae',2)}${desk(274,228,195)}${rect(323,158,83,53,'#4c6c7b')}${rect(329,164,71,39,'#d3e8e7')}${line(365,211,365,219,'#4c6c7b',5)}${plant(596,210)}${shelf(74,129)}`,
  };
  return shell + details[setting];
}

type PersonKind = 'adult'|'child'|'elder';
type ActorKind = PersonKind|'robot';
type ActorPose = NonNullable<MissionSceneEntity['pose']>;
type MissionPropAssetKind = Exclude<MissionPropKind,ActorKind>;
type PoseVariants = Record<ActorPose,string>;
type ActorAssets = Record<ActorKind,PoseVariants>;

const ACTOR_KINDS: readonly ActorKind[] = ['adult','child','elder','robot'];
const ACTOR_POSES: readonly ActorPose[] = ['idle','present','listen','work','walk'];
const ACTOR_KIND_SET: ReadonlySet<string> = new Set(ACTOR_KINDS);

const personPoses: Record<ActorPose,{
  arms: [string,string];
  hands: [[number,number],[number,number]];
  legs: string;
}> = {
  idle: {arms:['M-18 -61L-25 -47L-23 -32','M18 -61L26 -47L24 -32'],hands:[[-23,-32],[24,-32]],legs:'M-11 -27l-3 27h9l6 -27zm16 0 3 27h9l-2 -29z'},
  present: {arms:['M-18 -61L-25 -47L-23 -32','M18 -61L28 -53L41 -49L53 -49'],hands:[[-23,-32],[53,-49]],legs:'M-11 -27l-3 27h9l6 -27zm16 0 3 27h9l-2 -29z'},
  listen: {arms:['M-18 -61L-25 -47L-23 -32','M18 -61L25 -68L20 -75'],hands:[[-23,-32],[20,-75]],legs:'M-11 -27l-3 27h9l6 -27zm16 0 3 27h9l-2 -29z'},
  work: {arms:['M-18 -61L-24 -52L-13 -43','M18 -61L24 -52L13 -43'],hands:[[-13,-43],[13,-43]],legs:'M-11 -27l-3 27h9l6 -27zm16 0 3 27h9l-2 -29z'},
  walk: {arms:['M-18 -61L-27 -53L-33 -43','M18 -61L27 -54L33 -63'],hands:[[-33,-43],[33,-63]],legs:'M-11 -27l-12 12 -5 14h10l13 -15zm16 0 10 10 2 16H8L-1 -14z'},
};

const robotPoses: Record<ActorPose,{
  arms: [string,string];
  elbows: [[number,number],[number,number]];
  hands: [[number,number],[number,number]];
  legs: [string,string];
  knees: [[number,number],[number,number]];
}> = {
  idle: {arms:['M-22 -50L-30 -39L-34 -29','M22 -50L30 -39L34 -29'],elbows:[[-30,-39],[30,-39]],hands:[[-34,-29],[34,-29]],legs:['M-12 -22L-14 -1','M12 -22L14 -1'],knees:[[-13,-12],[13,-12]]},
  present: {arms:['M-22 -50L-30 -39L-34 -29','M22 -50L31 -43L43 -40L53 -40'],elbows:[[-30,-39],[31,-43]],hands:[[-34,-29],[53,-40]],legs:['M-12 -22L-14 -1','M12 -22L14 -1'],knees:[[-13,-12],[13,-12]]},
  listen: {arms:['M-22 -50L-30 -39L-34 -29','M22 -50L31 -58L29 -68'],elbows:[[-30,-39],[31,-58]],hands:[[-34,-29],[29,-68]],legs:['M-12 -22L-14 -1','M12 -22L14 -1'],knees:[[-13,-12],[13,-12]]},
  work: {arms:['M-22 -50L-28 -42L-13 -35','M22 -50L28 -42L13 -35'],elbows:[[-28,-42],[28,-42]],hands:[[-13,-35],[13,-35]],legs:['M-12 -22L-14 -1','M12 -22L14 -1'],knees:[[-13,-12],[13,-12]]},
  walk: {arms:['M-22 -50L-31 -43L-37 -33','M22 -50L31 -43L37 -54'],elbows:[[-31,-43],[31,-43]],hands:[[-37,-33],[37,-54]],legs:['M-12 -22L-23 -13L-27 -1','M12 -22L22 -13L20 -1'],knees:[[-22,-13],[21,-13]]},
};

function person(kind: PersonKind, pose: ActorPose): string {
  const child = kind === 'child', elder = kind === 'elder';
  const skin = child ? '#d8a07e' : elder ? '#d8ad91' : '#bd8868';
  const shirt = child ? '#cc8d59' : elder ? '#9b879f' : '#648f8e';
  const gesture = personPoses[pose];
  const arms = gesture.arms.map(path=>`<path d="${path}" stroke="${skin}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`).join('');
  const hands = gesture.hands.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.2" fill="${skin}"/>`).join('');
  const fingers = pose === 'present' ? `<path d="M53 -52v-5m4 5v-6m4 7v-5" stroke="${skin}" stroke-width="2" stroke-linecap="round"/>` : '';
  const figure = `<ellipse cx="0" cy="1" rx="23" ry="6" fill="#344d4a" opacity=".16"/><path d="${gesture.legs}" fill="#435866"/><path d="M-18 -64q18 -13 36 0l4 38h-43z" fill="${shirt}"/>${arms}<circle cy="-81" r="17" fill="${skin}"/><path d="M-17 -81q-4 -25 19 -20 20 0 16 24l-8 -12 -19 -1z" fill="${elder?'#e5e2d6':'#4c4440'}"/><path d="M-12 -77h4m11 0h4" stroke="#4a4641" stroke-width="2" stroke-linecap="round"/><path d="M-3 -68q4 3 7 -1" fill="none" stroke="#795444" stroke-width="1.7"/>${hands}${fingers}${elder?'<path d="M-15 -80h12v9h-12zm17 0h12v9H2zM-3 -76h5" fill="none" stroke="#687175" stroke-width="1.6"/>':''}${child?'<path d="M-11 -48h23v5h-23z" fill="#e9d7a8"/>':''}`;
  return child ? `<g transform="scale(.75)">${figure}</g>` : figure;
}

function robot(pose: ActorPose): string {
  const gesture = robotPoses[pose];
  const legs = gesture.legs.map((path,index)=>`<path d="${path}" stroke="#698b92" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="${gesture.knees[index][0]}" cy="${gesture.knees[index][1]}" r="3.5" fill="#c9deda" stroke="#698b92" stroke-width="2"/>`).join('');
  const arms = gesture.arms.map((path,index)=>`<path d="${path}" stroke="#8aacaf" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="${gesture.elbows[index][0]}" cy="${gesture.elbows[index][1]}" r="4" fill="#d4e5df" stroke="#698b92" stroke-width="2"/><circle cx="${gesture.hands[index][0]}" cy="${gesture.hands[index][1]}" r="4" fill="#d4e5df" stroke="#698b92" stroke-width="2"/>`).join('');
  const fingers = pose === 'present' ? '<path d="M53 -43v-5m4 5v-6m4 7v-5" stroke="#698b92" stroke-width="2" stroke-linecap="round"/>' : '';
  return `<ellipse cy="2" rx="24" ry="6" fill="#344d4a" opacity=".16"/>${legs}<rect x="-22" y="-59" width="44" height="39" rx="10" fill="#c4dddd" stroke="#6e959a" stroke-width="2"/>${arms}${fingers}<rect x="-25" y="-94" width="50" height="34" rx="12" fill="#f3f4df" stroke="#6e959a" stroke-width="2"/><rect x="-17" y="-85" width="34" height="15" rx="7" fill="#577a83"/><circle cx="-8" cy="-78" r="3" fill="#def3db"/><circle cx="8" cy="-78" r="3" fill="#def3db"/><path d="M0 -94v-8" stroke="#6e959a" stroke-width="3"/><circle cy="-104" r="4" fill="#cc9874"/><path d="M-7 -43h14m-7 -7v14" stroke="#6e959a" stroke-width="3"/>`;
}

function variants(build: (pose: ActorPose) => string): PoseVariants {
  return {idle:build('idle'),present:build('present'),listen:build('listen'),work:build('work'),walk:build('walk')};
}

const actorAssets: ActorAssets = {
  adult: variants(pose=>person('adult',pose)),
  child: variants(pose=>person('child',pose)),
  elder: variants(pose=>person('elder',pose)),
  robot: variants(robot),
};

function isActorKind(kind: MissionPropKind): kind is ActorKind { return ACTOR_KIND_SET.has(kind); }

function assets(): Record<MissionPropAssetKind,string> {
  return {
    phone:`${rect(-15,-57,30,55,'#536773',5)}${rect(-11,-51,22,39,'#d5e9e8',2)}${line(-6,-42,6,-42,'#8ab1b0',3)}${line(-6,-33,4,-33,'#c7a67a',3)}<circle cy="-7" r="2" fill="#c8d9d8"/>`,
    stop:'<ellipse cy="2" rx="30" ry="6" fill="#344d4a" opacity=".13"/><rect x="-28" y="-59" width="56" height="56" rx="9" fill="#d9534f" stroke="#993f44" stroke-width="3"/><rect x="-17" y="-45" width="34" height="12" rx="2" fill="#fff3dd"/><text x="0" y="-16" text-anchor="middle" fill="#fff3dd" font-family="sans-serif" font-size="10" font-weight="700" letter-spacing="1">STOP</text>',
    screen:`${rect(-38,-57,76,46,'#506c79',4)}${rect(-33,-52,66,35,'#d4e8e7',2)}${line(0,-11,0,-2,'#506c79',5)}${rect(-18,-3,36,5,'#506c79')}${line(-23,-36,-7,-25,'#91b7ad',4)}${line(-7,-25,16,-43,'#91b7ad',4)}`,
    document:`<path d="M-23 -61h33l14 14V0h-47z" fill="#faf7e9" stroke="#b5baae" stroke-width="2"/><path d="M10 -61v15h14" fill="#d9dfd1"/>${[0,1,2,3].map(i=>line(-13,-37+i*9,13-i*3,-37+i*9,'#9baea6',2)).join('')}`,
    book:`<path d="M-34 -48q19 -8 34 0 16 -8 34 0v45Q16 -10 0 -3q-16 -7 -34 0z" fill="#f6ecd4" stroke="#a78566" stroke-width="2"/><path d="M0 -48v45" stroke="#bfaf8d" stroke-width="2"/>${line(-25,-35,-8,-32,'#b4b29c',2)}${line(8,-32,25,-35,'#b4b29c',2)}${line(-25,-24,-8,-21,'#b4b29c',2)}${line(8,-21,25,-24,'#b4b29c',2)}`,
    mug:'<ellipse cy="2" rx="23" ry="5" fill="#586d66" opacity=".13"/><path d="M14 -34h10q15 15 -3 23h-7" fill="none" stroke="#b98169" stroke-width="7"/><path d="M-19 -39h36v28q0 13 -18 13t-18 -13z" fill="#ce9a80"/><ellipse cx="-1" cy="-39" rx="18" ry="5" fill="#825e4c"/><path d="M-8 -47q-9 -10 0 -19m13 19q-8 -11 0 -19" fill="none" stroke="#e5e1d5" stroke-width="3"/>',
    cart:'<path d="M-38 -61h10l9 42h45l10 -31h-61" fill="#d1ddd0" stroke="#6b8b84" stroke-width="4" stroke-linejoin="round"/><path d="M-13 -47v24m14 -24v24m14 -24v24" stroke="#91aaa0" stroke-width="2"/><circle cx="-12" cy="-6" r="6" fill="#50646b"/><circle cx="22" cy="-6" r="6" fill="#50646b"/>',
    bag:'<path d="M-25 -44h50l5 43h-60z" fill="#c99b6f" stroke="#a77c54" stroke-width="2"/><path d="M-12 -41v-10q12 -19 24 0v10" fill="none" stroke="#997552" stroke-width="5"/>',
    calendar:`${rect(-31,-58,62,57,'#f4f2e1',5)}${rect(-31,-58,62,15,'#bd7f71',5)}${[0,1,2].flatMap(i=>[0,1,2].map(j=>rect(-21+j*17,-35+i*11,9,6,i===1&&j===1?'#c48a65':'#c6d1be',1))).join('')}${line(-17,-63,-17,-52,'#788f8b',4)}${line(17,-63,17,-52,'#788f8b',4)}`,
    poster:`${rect(-29,-68,58,68,'#f9ecd6',2)}${rect(-23,-62,46,37,'#c88c80',1)}<circle cx="0" cy="-43" r="12" fill="#e8c779"/>${line(-19,-15,19,-15,'#9d9b84',3)}${line(-13,-8,13,-8,'#b4aa91',2)}`,
    microphone:'<path d="M0 -26v26m-15 0h30" stroke="#5c707a" stroke-width="4"/><rect x="-11" y="-64" width="22" height="39" rx="11" fill="#718b97"/><path d="M-18 -43v9q18 28 36 0v-9" fill="none" stroke="#506974" stroke-width="4"/><path d="M-6 -57h12m-12 7h12m-12 7h12" stroke="#b7cbd0" stroke-width="2"/>',
    camera:'<path d="M-27 -44v-8h20l6 8" fill="#8299a0"/><rect x="-36" y="-44" width="72" height="43" rx="7" fill="#526c7a"/><circle cy="-23" r="19" fill="#a4bdc0"/><circle cy="-23" r="13" fill="#344e60"/><circle cx="-4" cy="-27" r="5" fill="#7dabb7"/><rect x="21" y="-37" width="9" height="6" rx="1" fill="#e3d8b4"/>',
    chart:`${rect(-34,-58,68,56,'#f5f4e8')}${line(-24,-10,27,-10,'#9baca3',2)}${rect(-22,-30,10,19,'#86ada6',1)}${rect(-5,-43,10,32,'#cba479',1)}${rect(12,-51,10,40,'#8c9bb7',1)}`,
    magnifier:'<circle cx="-7" cy="-38" r="23" fill="#d0e8e4" fill-opacity=".8" stroke="#6b8e95" stroke-width="7"/><path d="M10 -21l22 22" stroke="#b48b68" stroke-width="10" stroke-linecap="round"/><path d="M-21 -44q4 -13 17 -11" stroke="#f7fcf5" stroke-width="4" fill="none" stroke-linecap="round"/>',
    shield:'<path d="M0 -64l29 11 -4 30Q20 -8 0 2 -20 -8 -25 -23l-4 -30z" fill="#85a99c" stroke="#5e887d" stroke-width="3"/><path d="M-13 -31l10 11 18 -24" fill="none" stroke="#f3efda" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    check:'<circle cy="-28" r="28" fill="#d9e6cf" stroke="#8ca781" stroke-width="2"/><path d="M-15 -28l11 12 21 -26" fill="none" stroke="#668b6e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    heart:'<path d="M0 -2C-68 -40 -18 -76 0 -48 21 -76 67 -40 0 -2" fill="#c98482" stroke="#b37375" stroke-width="2"/><path d="M-22 -44q0 -9 10 -10" fill="none" stroke="#e5b4a9" stroke-width="4" stroke-linecap="round"/>',
    playlist:`${rect(-28,-59,56,58,'#eef0dc',5)}${line(-17,-45,17,-45,'#8ca69b',3)}${line(-17,-34,3,-34,'#8ca69b',3)}<path d="M9 -29v18q-17 -5 -12 5 12 8 18 -1v-26l10 -3v-7z" fill="#ac8a74"/>`,
    globe:'<circle cy="-36" r="26" fill="#a3cbd2" stroke="#719ca5" stroke-width="2"/><path d="M-20 -49l14 -8 8 12 -5 14 -14 -4m22 -9 17 8 -4 16 -12 7 -9 -13" fill="#9db889"/><path d="M-31 -55q-16 49 24 51h11M-3 -4v7m-16 0h35" fill="none" stroke="#977f65" stroke-width="4"/>',
    clapperboard:'<rect x="-35" y="-40" width="70" height="39" rx="3" fill="#536876"/><path d="M-35 -53l66 -14 4 15 -67 14z" fill="#e9e6d5" stroke="#536876" stroke-width="2"/><path d="M-25 -55l8 12m11 -17 8 12m12 -17 8 12" stroke="#536876" stroke-width="8"/><path d="M-25 -25h50m-50 10H9" stroke="#b6c9ca" stroke-width="2"/>',
    lightbulb:'<path d="M-11 -17q0 -10 -10 -21 -13 -30 21 -33 34 3 21 33 -10 11 -10 21z" fill="#efd89a" stroke="#c5aa6f" stroke-width="2"/><path d="M-10 -17h20v13H-10z" fill="#82999a"/><path d="M-6 -2h12" stroke="#5a767d" stroke-width="4"/><path d="M-8 -37l8 9 8 -9M0 -28v10" stroke="#c2a05f" stroke-width="2" fill="none"/>',
  };
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string,string> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS,name);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  return node;
}
const position = (entity: MissionSceneEntity) => `translate(${entity.x * 7.2}px, ${entity.y * 3.6}px) scale(${entity.scale ?? 1})`;

export function createMissionStage(host: HTMLElement, language: 'zh'|'en'): MissionStage {
  const prefix = `mission-stage-${++sequence}`;
  const stage = document.createElement('figure');
  stage.className = 'mission-stage';
  const svg = svgElement('svg', {viewBox:'0 0 720 360',role:'img','aria-labelledby':`${prefix}-title ${prefix}-desc`});
  const title = svgElement('title',{id:`${prefix}-title`});
  const desc = svgElement('desc',{id:`${prefix}-desc`});
  const defs = svgElement('defs');
  for (const [kind,art] of Object.entries(assets())) {
    const symbol = svgElement('g',{id:`${prefix}-${kind}`});
    symbol.innerHTML = art;
    defs.append(symbol);
  }
  for (const kind of ACTOR_KINDS) for (const pose of ACTOR_POSES) {
    const symbol = svgElement('g',{id:`${prefix}-${kind}-${pose}`});
    symbol.innerHTML = actorAssets[kind][pose];
    defs.append(symbol);
  }
  const backdrop = svgElement('g',{'aria-hidden':'true'});
  const flowLayer = svgElement('g',{'aria-hidden':'true',class:'mission-stage-flows'});
  const entityLayer = svgElement('g',{'aria-hidden':'true'});
  svg.append(title,desc,defs,backdrop,flowLayer,entityLayer);
  const caption = document.createElement('figcaption');
  stage.append(svg,caption);
  host.append(stage);
  const entities = new Map<string,SVGGElement>();
  let animations: Animation[] = [];
  let active = true, motion = true, disposed = false;
  let lastSignature = '', missionKey = '', currentSetting: MissionSetting | null = null;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = () => { animations.forEach(animation => animation.cancel()); animations = []; stage.dataset.animating = 'false'; };
  const stop = () => cancel();
  const onVisibility = () => { if (document.hidden) stop(); };
  const onMotion = () => { if (media.matches) stop(); };
  document.addEventListener('visibilitychange',onVisibility);
  media.addEventListener('change',onMotion);
  const animate = (node: Element, frames: Keyframe[], duration = 1150) => {
    const animation = node.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.24,1)',fill:'none'});
    animations.push(animation);
    animation.finished.then(() => {
      animations = animations.filter(item => item !== animation);
      if (!animations.length) stage.dataset.animating = 'false';
    }).catch(() => {});
  };
  return {
    update(input: MissionStageInput) {
      if (disposed) return;
      const choice = input.previewChoiceId ?? input.choiceId;
      const frame = choice ? input.definition.choices[choice] ?? input.definition.initial : input.definition.initial;
      const signature = JSON.stringify([input.key, input.definition.setting, choice, Boolean(input.previewChoiceId), frame]);
      if (signature === lastSignature) return;
      const sameMission = input.key === missionKey && input.definition.setting === currentSetting;
      const canAnimate = sameMission && choice !== null && active && motion && !media.matches && !document.hidden;
      const visible = new Map<string,{transform:string;opacity:string}>();
      if (canAnimate) for (const [id,node] of entities) {
        const style = getComputedStyle(node);
        visible.set(id,{transform:style.transform,opacity:style.opacity});
      }
      cancel();
      lastSignature = signature;
      missionKey = input.key;
      stage.dataset.choiceId = choice ?? '';
      stage.dataset.preview = String(Boolean(input.previewChoiceId));
      stage.dataset.animating = String(canAnimate);
      svg.dataset.setting = input.definition.setting;
      if (!sameMission) {
        entities.clear(); entityLayer.replaceChildren(); flowLayer.replaceChildren();
        backdrop.innerHTML = room(input.definition.setting);
      }
      currentSetting = input.definition.setting;
      title.textContent = input.definition.title[language];
      desc.textContent = frame.description[language];
      caption.textContent = `${language === 'zh' ? '情境演示' : 'Scene demonstration'}${input.previewChoiceId ? (language === 'zh' ? ' · 預覽' : ' · Preview') : ''} · ${frame.description[language]}`;
      const present = new Set(frame.entities.map(entity=>entity.id));
      for (const [id,node] of entities) if (!present.has(id)) { node.remove(); entities.delete(id); }
      for (const entity of [...frame.entities].sort((a,b)=>a.y-b.y)) {
        let node = entities.get(entity.id);
        const existing = Boolean(node);
        if (!node) {
          node = svgElement('g',{'data-scene-entity':entity.id});
          node.append(svgElement('use'));
          const label = svgElement('text',{class:'mission-stage-label',x:'0',y:'19','text-anchor':'middle'});
          node.append(label);
          entities.set(entity.id,node);
        }
        node.dataset.kind = entity.kind;
        node.dataset.x = String(entity.x);
        node.dataset.y = String(entity.y);
        node.dataset.pose = entity.pose ?? 'idle';
        node.dataset.opacity = String(entity.opacity ?? 1);
        node.style.transform = position(entity);
        node.style.opacity = String(entity.opacity ?? 1);
        const use = node.querySelector('use')!;
        const asset = isActorKind(entity.kind) ? `${entity.kind}-${entity.pose ?? 'idle'}` : entity.kind;
        use.setAttribute('href',`#${prefix}-${asset}`);
        const pose = entity.pose === 'present' ? -7 : entity.pose === 'work' ? 5 : entity.pose === 'listen' ? -3 : 0;
        use.style.transform = `rotate(${pose}deg)`;
        node.querySelector('text')!.textContent = entity.label?.[language] ?? '';
        entityLayer.append(node);
        if (canAnimate) {
          const before = visible.get(entity.id);
          animate(node,[{transform:before?.transform ?? position({...entity,x:entity.x-3}),opacity:before?.opacity ?? '0'},{transform:position(entity),opacity:entity.opacity ?? 1}]);
          animate(use,[{transform:`rotate(${existing?0:-10}deg)`},{transform:`rotate(${pose+(entity.pose==='walk'?5:2)}deg)`,offset:.45},{transform:`rotate(${pose}deg)`}],1000);
        }
      }
      flowLayer.replaceChildren();
      for (const flow of frame.flows) {
        const from = frame.entities.find(entity=>entity.id===flow.from), to = frame.entities.find(entity=>entity.id===flow.to);
        if (!from || !to) continue;
        const x = from.x*7.2, y = from.y*3.6-44, endX=to.x*7.2, endY=to.y*3.6-44;
        const path = svgElement('path',{'data-scene-flow':flow.id,'data-kind':flow.kind,d:`M${x} ${y}Q${(x+endX)/2} ${Math.min(y,endY)-45} ${endX} ${endY}`,fill:'none',stroke:flow.kind==='pause'?'#9a8c7a':flow.kind==='review'?'#af8a54':'#648f8b','stroke-width':'3','stroke-linecap':'round',pathLength:'1'});
        if (flow.kind==='pause') path.setAttribute('stroke-dasharray','.035 .035');
        flowLayer.append(path);
        const point = svgElement('circle',{cx:String(endX),cy:String(endY),r:'5',fill:flow.kind==='pause'?'#9a8c7a':'#648f8b'});
        flowLayer.append(point);
        if (canAnimate) animate(path,[{strokeDasharray:'1',strokeDashoffset:'1',opacity:0},{strokeDasharray:'1',strokeDashoffset:'0',opacity:1}],1250);
      }
    },
    setActive(value) { active = value; if (!value) stop(); },
    setMotion(value) { motion = value; if (!value) stop(); },
    dispose() {
      if (disposed) return;
      disposed = true; stop();
      document.removeEventListener('visibilitychange',onVisibility);
      media.removeEventListener('change',onMotion);
      stage.remove(); entities.clear();
    },
  };
}
