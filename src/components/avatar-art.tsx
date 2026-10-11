import type { ReactNode } from 'react'
import type { AvatarBgId } from '@shared/types.ts'

/**
 * Illustrated avatars: flat vector characters drawn as SVG components, no image files.
 * Every character is a bust on a round background, painted from a small palette:
 *   main   body / fur            dark   ears, stripes, flippers
 *   light  muzzle, belly         accent inner ears, cheeks, beak, tongue
 * Each character ships a few palettes (a green or a pink frog) and a default background.
 */

export interface Palette {
  main: string
  dark: string
  light: string
  accent: string
}

type Draw = (p: Palette) => ReactNode

interface Character {
  /** Background used until the user picks one. */
  bg: BackgroundId
  /** Variants, first is the default. */
  variants: Palette[]
  draw: Draw
}

const INK = '#2a2233'
const WHITE = '#ffffff'

export const AVATAR_BACKGROUNDS: Record<AvatarBgId, string> = {
  mint: '#a8e6cf',
  sky: '#a9d6ff',
  lavender: '#cdbffb',
  pink: '#ffc4dc',
  peach: '#ffd0a8',
  sun: '#ffe38a',
  coral: '#ff9f93',
  sage: '#c9d9a7',
  slate: '#b4c0d4',
  cream: '#f3ead4',
  night: '#303a58',
}
export type BackgroundId = AvatarBgId
export const BACKGROUND_IDS = Object.keys(AVATAR_BACKGROUNDS) as BackgroundId[]

const p = (main: string, dark: string, light: string, accent: string): Palette => ({
  main,
  dark,
  light,
  accent,
})

/* ---------- shared pieces ---------- */

function Eye({ cx, cy, r = 5 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={INK} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.34} r={r * 0.36} fill={WHITE} />
    </>
  )
}

function Eyes({ y = 62, gap = 26, r = 5 }: { y?: number; gap?: number; r?: number }) {
  return (
    <>
      <Eye cx={64 - gap / 2} cy={y} r={r} />
      <Eye cx={64 + gap / 2} cy={y} r={r} />
    </>
  )
}

function Cheeks({ y = 74, gap = 44, rx = 7, ry = 4.5, color = '#ff8fa6', opacity = 0.55 }) {
  return (
    <>
      <ellipse cx={64 - gap / 2} cy={y} rx={rx} ry={ry} fill={color} opacity={opacity} />
      <ellipse cx={64 + gap / 2} cy={y} rx={rx} ry={ry} fill={color} opacity={opacity} />
    </>
  )
}

function Torso({ fill, d }: { fill: string; d?: string }) {
  return <path d={d ?? 'M14 128 C14 104 38 94 64 94 C90 94 114 104 114 128 Z'} fill={fill} />
}

/* ---------- characters ---------- */

const dog: Draw = (c) => (
  <>
    <Torso fill={c.light} />
    <ellipse cx={26} cy={64} rx={13} ry={25} fill={c.dark} transform="rotate(14 26 64)" />
    <ellipse cx={102} cy={64} rx={13} ry={25} fill={c.dark} transform="rotate(-14 102 64)" />
    <ellipse cx={64} cy={64} rx={39} ry={35} fill={c.main} />
    <ellipse cx={47} cy={58} rx={13} ry={14} fill={c.dark} opacity={0.9} />
    <ellipse cx={64} cy={80} rx={21} ry={15} fill={c.light} />
    <Eyes y={60} gap={30} r={5.5} />
    <ellipse cx={64} cy={72} rx={7.5} ry={5.5} fill={INK} />
    <ellipse cx={62} cy={70} rx={2.4} ry={1.4} fill={WHITE} opacity={0.7} />
    <path
      d="M64 77 V82 M64 82 Q57 90 51 84 M64 82 Q71 90 77 84"
      fill="none"
      stroke={INK}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
    <path d="M58 87 Q64 102 70 87 Z" fill={c.accent} />
  </>
)

const cat: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <path d="M26 56 L28 18 L58 38 Z" fill={c.main} />
    <path d="M102 56 L100 18 L70 38 Z" fill={c.main} />
    <path d="M33 44 L34 28 L49 38 Z" fill={c.accent} />
    <path d="M95 44 L94 28 L79 38 Z" fill={c.accent} />
    <ellipse cx={64} cy={66} rx={41} ry={34} fill={c.main} />
    <path
      d="M64 33 V44 M53 35 L55 44 M75 35 L73 44"
      stroke={c.dark}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
    <path d="M24 62 L36 64 M24 72 L36 70" stroke={c.dark} strokeWidth={3} strokeLinecap="round" />
    <path d="M104 62 L92 64 M104 72 L92 70" stroke={c.dark} strokeWidth={3} strokeLinecap="round" />
    <ellipse cx={64} cy={78} rx={17} ry={11} fill={c.light} />
    <Eyes y={63} gap={30} r={5.5} />
    <path d="M59.5 71 H68.5 L64 76.5 Z" fill={c.accent} />
    <path
      d="M64 76.5 V80 M64 80 Q58 85 53 81 M64 80 Q70 85 75 81"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <path
      d="M42 78 L26 75 M42 82 L27 85 M86 78 L102 75 M86 82 L101 85"
      stroke={c.light}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Cheeks y={74} gap={52} color={c.accent} opacity={0.4} />
  </>
)

const fox: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <path d="M28 62 L22 20 L54 42 Z" fill={c.main} />
    <path d="M100 62 L106 20 L74 42 Z" fill={c.main} />
    <path d="M24 26 L33 36 L21 42 Z" fill={c.dark} />
    <path d="M104 26 L95 36 L107 42 Z" fill={c.dark} />
    <path d="M64 100 L20 66 Q22 50 40 46 Q64 38 88 46 Q106 50 108 66 Z" fill={c.main} />
    <path d="M64 100 L22 70 Q44 70 64 82 Q84 70 106 70 Z" fill={c.light} />
    <path d="M64 100 Q50 92 46 84 Q58 88 64 88 Q70 88 82 84 Q78 92 64 100 Z" fill={c.light} />
    <Eyes y={62} gap={32} r={5} />
    <ellipse cx={64} cy={86} rx={6} ry={4.5} fill={INK} />
    <ellipse cx={62.4} cy={84.6} rx={2} ry={1.2} fill={WHITE} opacity={0.7} />
    <path
      d="M64 90 Q58 96 53 92 M64 90 Q70 96 75 92"
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.0}
    />
  </>
)

const bear: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <circle cx={29} cy={34} r={14} fill={c.main} />
    <circle cx={99} cy={34} r={14} fill={c.main} />
    <circle cx={29} cy={35} r={7} fill={c.accent} />
    <circle cx={99} cy={35} r={7} fill={c.accent} />
    <circle cx={64} cy={64} r={40} fill={c.main} />
    <ellipse cx={64} cy={77} rx={18} ry={14} fill={c.light} />
    <Eyes y={58} gap={30} r={5} />
    <ellipse cx={64} cy={70} rx={7} ry={5} fill={INK} />
    <ellipse cx={62} cy={68.4} rx={2.2} ry={1.3} fill={WHITE} opacity={0.7} />
    <path
      d="M64 75 V80 M64 80 Q59 85 55 81 M64 80 Q69 85 73 81"
      fill="none"
      stroke={INK}
      strokeWidth={2.3}
      strokeLinecap="round"
    />
  </>
)

const panda: Draw = (c) => (
  <>
    <Torso fill={c.light} />
    <path
      d="M14 128 C14 112 22 104 34 100 L46 128 Z M114 128 C114 112 106 104 94 100 L82 128 Z"
      fill={c.dark}
    />
    <circle cx={28} cy={32} r={15} fill={c.dark} />
    <circle cx={100} cy={32} r={15} fill={c.dark} />
    <circle cx={64} cy={64} r={41} fill={c.light} />
    <ellipse cx={46} cy={61} rx={10.5} ry={14} fill={c.dark} transform="rotate(22 46 61)" />
    <ellipse cx={82} cy={61} rx={10.5} ry={14} fill={c.dark} transform="rotate(-22 82 61)" />
    <circle cx={47} cy={60} r={5.2} fill={WHITE} />
    <circle cx={81} cy={60} r={5.2} fill={WHITE} />
    <circle cx={47.6} cy={60.4} r={3.2} fill={INK} />
    <circle cx={80.4} cy={60.4} r={3.2} fill={INK} />
    <circle cx={46.6} cy={59.2} r={1.1} fill={WHITE} />
    <circle cx={79.4} cy={59.2} r={1.1} fill={WHITE} />
    <ellipse cx={64} cy={76} rx={7} ry={5} fill={c.dark} />
    <path
      d="M64 81 Q58 87 53 83 M64 81 Q70 87 75 83"
      fill="none"
      stroke={c.dark}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
    <Cheeks y={80} gap={56} rx={6} ry={4} color={c.accent} opacity={0.5} />
  </>
)

const rabbit: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <ellipse cx={44} cy={26} rx={11} ry={28} fill={c.main} transform="rotate(-9 44 26)" />
    <ellipse cx={84} cy={26} rx={11} ry={28} fill={c.main} transform="rotate(9 84 26)" />
    <ellipse cx={44} cy={28} rx={5.5} ry={21} fill={c.accent} transform="rotate(-9 44 28)" />
    <ellipse cx={84} cy={28} rx={5.5} ry={21} fill={c.accent} transform="rotate(9 84 28)" />
    <ellipse cx={64} cy={73} rx={39} ry={32} fill={c.main} />
    <ellipse cx={50} cy={82} rx={15} ry={11} fill={c.light} />
    <ellipse cx={78} cy={82} rx={15} ry={11} fill={c.light} />
    <Eyes y={67} gap={32} r={5.2} />
    <path d="M60.5 74 H67.5 L64 78 Z" fill={c.accent} />
    <path
      d="M64 78 V82 M64 82 Q59 86 55 83 M64 82 Q69 86 73 83"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <rect x={60} y={83} width={8} height={8} rx={2} fill={WHITE} stroke={c.dark} strokeWidth={1} />
    <Cheeks y={78} gap={58} color={c.accent} opacity={0.45} />
  </>
)

const koala: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <circle cx={27} cy={50} r={20} fill={c.main} />
    <circle cx={101} cy={50} r={20} fill={c.main} />
    <circle cx={27} cy={50} r={11} fill={c.light} />
    <circle cx={101} cy={50} r={11} fill={c.light} />
    <ellipse cx={64} cy={66} rx={38} ry={34} fill={c.main} />
    <ellipse cx={64} cy={86} rx={13} ry={9} fill={c.light} opacity={0.8} />
    <Eyes y={57} gap={30} r={4.6} />
    <ellipse cx={64} cy={72} rx={10.5} ry={13.5} fill={INK} />
    <ellipse cx={61} cy={67} rx={3.2} ry={2.6} fill={WHITE} opacity={0.55} />
    <path
      d="M58 90 Q64 95 70 90"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </>
)

const tiger: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <circle cx={31} cy={36} r={14} fill={c.main} />
    <circle cx={97} cy={36} r={14} fill={c.main} />
    <circle cx={31} cy={37} r={7} fill={c.light} />
    <circle cx={97} cy={37} r={7} fill={c.light} />
    <ellipse cx={64} cy={65} rx={41} ry={35} fill={c.main} />
    <path
      d="M64 31 V45 M52 33 L55 46 M76 33 L73 46"
      stroke={c.dark}
      strokeWidth={4}
      strokeLinecap="round"
    />
    <path
      d="M23 58 L37 62 M22 70 L36 71 M105 58 L91 62 M106 70 L92 71"
      stroke={c.dark}
      strokeWidth={3.6}
      strokeLinecap="round"
    />
    <ellipse cx={64} cy={79} rx={19} ry={13} fill={c.light} />
    <Eyes y={61} gap={30} r={5.4} />
    <path d="M59 70 H69 L64 76 Z" fill={c.accent} />
    <path
      d="M64 76 V80 M64 80 Q58 85 53 81 M64 80 Q70 85 75 81"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </>
)

const lion: Draw = (c) => {
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2
    return [64 + Math.cos(a) * 41, 62 + Math.sin(a) * 40] as const
  })
  return (
    <>
      <Torso fill={c.main} />
      {puffs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={15} fill={c.dark} />
      ))}
      <circle cx={64} cy={62} r={42} fill={c.dark} />
      <circle cx={39} cy={38} r={8} fill={c.main} />
      <circle cx={89} cy={38} r={8} fill={c.main} />
      <circle cx={39} cy={39} r={4} fill={c.accent} />
      <circle cx={89} cy={39} r={4} fill={c.accent} />
      <ellipse cx={64} cy={64} rx={31} ry={29} fill={c.main} />
      <ellipse cx={64} cy={76} rx={16} ry={11} fill={c.light} />
      <Eyes y={58} gap={28} r={5} />
      <path d="M59 67 H69 L64 74 Z" fill={INK} />
      <path
        d="M64 74 V78 M64 78 Q58 83 53 79 M64 78 Q70 83 75 79"
        fill="none"
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  )
}

const pig: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <path d="M28 46 L20 20 L52 32 Z" fill={c.dark} />
    <path d="M100 46 L108 20 L76 32 Z" fill={c.dark} />
    <circle cx={64} cy={64} r={41} fill={c.main} />
    <Eyes y={56} gap={32} r={5.2} />
    <ellipse cx={64} cy={74} rx={18} ry={13.5} fill={c.accent} />
    <ellipse cx={57.5} cy={74} rx={2.8} ry={4.4} fill={c.dark} />
    <ellipse cx={70.5} cy={74} rx={2.8} ry={4.4} fill={c.dark} />
    <path
      d="M52 90 Q64 97 76 90"
      fill="none"
      stroke={INK}
      strokeWidth={2.3}
      strokeLinecap="round"
      opacity={0.0}
    />
    <Cheeks y={66} gap={64} rx={6.5} ry={4.5} color={c.accent} opacity={0.6} />
  </>
)

const frog: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <ellipse cx={64} cy={120} rx={26} ry={22} fill={c.light} />
    <circle cx={40} cy={42} r={17} fill={c.main} />
    <circle cx={88} cy={42} r={17} fill={c.main} />
    <ellipse cx={64} cy={70} rx={44} ry={31} fill={c.main} />
    <circle cx={40} cy={41} r={12} fill={WHITE} />
    <circle cx={88} cy={41} r={12} fill={WHITE} />
    <circle cx={41.5} cy={42.5} r={6.4} fill={INK} />
    <circle cx={86.5} cy={42.5} r={6.4} fill={INK} />
    <circle cx={39.4} cy={40} r={2.3} fill={WHITE} />
    <circle cx={84.4} cy={40} r={2.3} fill={WHITE} />
    <path
      d="M30 74 Q64 102 98 74"
      fill="none"
      stroke={c.dark}
      strokeWidth={3.2}
      strokeLinecap="round"
    />
    <circle cx={58} cy={62} r={1.8} fill={c.dark} />
    <circle cx={70} cy={62} r={1.8} fill={c.dark} />
    <Cheeks y={80} gap={78} rx={7} ry={5} color={c.accent} opacity={0.6} />
  </>
)

const penguin: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <ellipse cx={64} cy={124} rx={24} ry={28} fill={c.light} />
    <path d="M12 126 Q6 104 22 94 Q36 108 38 128 Z" fill={c.dark} />
    <path d="M116 126 Q122 104 106 94 Q92 108 90 128 Z" fill={c.dark} />
    <circle cx={64} cy={60} r={39} fill={c.main} />
    <circle cx={49} cy={64} r={17} fill={c.light} />
    <circle cx={79} cy={64} r={17} fill={c.light} />
    <ellipse cx={64} cy={78} rx={25} ry={17} fill={c.light} />
    <Eye cx={51} cy={61} r={4.6} />
    <Eye cx={77} cy={61} r={4.6} />
    <path d="M57 69 Q64 66 71 69 Q70 79 64 83 Q58 79 57 69 Z" fill={c.accent} />
    <Cheeks y={72} gap={50} rx={5} ry={3.4} color="#ff9aa8" opacity={0.5} />
  </>
)

const owl: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <ellipse cx={64} cy={122} rx={28} ry={24} fill={c.light} />
    <path
      d="M52 108 Q58 112 64 108 Q70 112 76 108 M54 118 Q60 122 64 118 Q68 122 74 118"
      fill="none"
      stroke={c.dark}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0.7}
    />
    <path d="M26 46 L22 18 L50 32 Z" fill={c.dark} />
    <path d="M102 46 L106 18 L78 32 Z" fill={c.dark} />
    <ellipse cx={64} cy={62} rx={43} ry={38} fill={c.main} />
    <circle cx={45} cy={60} r={18} fill={c.light} />
    <circle cx={83} cy={60} r={18} fill={c.light} />
    <circle cx={45} cy={60} r={18} fill="none" stroke={c.dark} strokeWidth={2.4} />
    <circle cx={83} cy={60} r={18} fill="none" stroke={c.dark} strokeWidth={2.4} />
    <circle cx={45} cy={61} r={10.5} fill={c.accent} />
    <circle cx={83} cy={61} r={10.5} fill={c.accent} />
    <circle cx={45} cy={61} r={6.2} fill={INK} />
    <circle cx={83} cy={61} r={6.2} fill={INK} />
    <circle cx={43} cy={58.6} r={2.2} fill={WHITE} />
    <circle cx={81} cy={58.6} r={2.2} fill={WHITE} />
    <path
      d="M58 70 Q64 68 70 70 L64 86 Z"
      fill={c.accent}
      stroke={c.dark}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  </>
)

const monkey: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <circle cx={21} cy={64} r={14} fill={c.main} />
    <circle cx={107} cy={64} r={14} fill={c.main} />
    <circle cx={21} cy={64} r={8} fill={c.light} />
    <circle cx={107} cy={64} r={8} fill={c.light} />
    <circle cx={64} cy={60} r={39} fill={c.main} />
    <circle cx={49} cy={62} r={17.5} fill={c.light} />
    <circle cx={79} cy={62} r={17.5} fill={c.light} />
    <ellipse cx={64} cy={80} rx={23} ry={16} fill={c.light} />
    <Eyes y={62} gap={26} r={4.8} />
    <ellipse cx={60.5} cy={73} rx={1.8} ry={2.4} fill={c.dark} />
    <ellipse cx={67.5} cy={73} rx={1.8} ry={2.4} fill={c.dark} />
    <path
      d="M52 82 Q64 94 76 82"
      fill="none"
      stroke={INK}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <path
      d="M58 40 Q64 34 70 40"
      fill="none"
      stroke={c.dark}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.5}
    />
  </>
)

const raccoon: Draw = (c) => (
  <>
    <Torso fill={c.main} />
    <path d="M26 54 Q22 26 38 24 Q52 28 54 42 Z" fill={c.main} />
    <path d="M102 54 Q106 26 90 24 Q76 28 74 42 Z" fill={c.main} />
    <path d="M32 44 Q32 32 40 31 Q46 34 47 41 Z" fill={c.dark} />
    <path d="M96 44 Q96 32 88 31 Q82 34 81 41 Z" fill={c.dark} />
    <ellipse cx={64} cy={66} rx={41} ry={35} fill={c.main} />
    <path d="M64 33 V50" stroke={c.dark} strokeWidth={7} strokeLinecap="round" />
    <ellipse cx={64} cy={80} rx={22} ry={15} fill={c.light} />
    <path
      d="M26 62 Q30 52 48 54 L64 58 L80 54 Q98 52 102 62 Q98 76 80 72 L64 66 L48 72 Q30 76 26 62 Z"
      fill={c.dark}
    />
    <circle cx={48} cy={63} r={6} fill={WHITE} />
    <circle cx={80} cy={63} r={6} fill={WHITE} />
    <circle cx={49} cy={63.5} r={3.4} fill={INK} />
    <circle cx={79} cy={63.5} r={3.4} fill={INK} />
    <circle cx={47.6} cy={62} r={1.2} fill={WHITE} />
    <circle cx={77.6} cy={62} r={1.2} fill={WHITE} />
    <ellipse cx={64} cy={77} rx={6} ry={4.4} fill={INK} />
    <path
      d="M64 81 Q58 87 53 83 M64 81 Q70 87 75 83"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </>
)

const unicorn: Draw = (c) => (
  <>
    <Torso fill={c.light} />
    <path d="M24 90 Q10 70 18 44 Q30 60 34 84 Z" fill={c.accent} />
    <path d="M104 90 Q118 70 110 44 Q98 60 94 84 Z" fill={c.accent} />
    <path d="M30 52 L26 22 L52 38 Z" fill={c.main} />
    <path d="M98 52 L102 22 L76 38 Z" fill={c.main} />
    <path d="M33 44 L31 30 L45 38 Z" fill={c.accent} opacity={0.7} />
    <path d="M95 44 L97 30 L83 38 Z" fill={c.accent} opacity={0.7} />
    <path d="M64 4 L55 40 L73 40 Z" fill="#ffd86b" />
    <path
      d="M60 22 L69 25 M58 31 L71 34"
      stroke="#f0a93a"
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <ellipse cx={64} cy={68} rx={38} ry={32} fill={c.main} />
    <path d="M26 50 Q40 26 64 34 Q60 46 44 56 Q34 60 26 50 Z" fill={c.accent} />
    <path d="M64 34 Q86 30 102 52 Q92 52 82 48 Q70 44 64 34 Z" fill={c.accent} opacity={0.85} />
    <ellipse cx={64} cy={82} rx={18} ry={12} fill={c.light} />
    <Eyes y={66} gap={30} r={5.4} />
    <path d="M44 61 L40 58 M84 61 L88 58" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    <ellipse cx={58} cy={81} rx={1.8} ry={2.6} fill={c.dark} />
    <ellipse cx={70} cy={81} rx={1.8} ry={2.6} fill={c.dark} />
    <path
      d="M56 88 Q64 93 72 88"
      fill="none"
      stroke={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <Cheeks y={76} gap={58} color={c.accent} opacity={0.5} />
  </>
)

const chick: Draw = (c) => (
  <>
    <Torso fill={c.light} />
    <ellipse cx={22} cy={96} rx={12} ry={20} fill={c.main} transform="rotate(24 22 96)" />
    <ellipse cx={106} cy={96} rx={12} ry={20} fill={c.main} transform="rotate(-24 106 96)" />
    <circle cx={64} cy={64} r={40} fill={c.main} />
    <path
      d="M56 26 Q52 12 62 14 M64 24 Q66 8 74 12 M72 26 Q80 16 84 24"
      fill="none"
      stroke={c.main}
      strokeWidth={6}
      strokeLinecap="round"
    />
    <Eyes y={58} gap={30} r={5.4} />
    <path d="M55 68 Q64 62 73 68 Q72 78 64 82 Q56 78 55 68 Z" fill={c.accent} />
    <path
      d="M58 72 Q64 70 70 72"
      fill="none"
      stroke={c.dark}
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={0.6}
    />
    <Cheeks y={72} gap={54} rx={6.5} ry={4.4} color="#ff9a8a" opacity={0.55} />
  </>
)

const robot: Draw = (c) => (
  <>
    <rect x={30} y={96} width={68} height={40} rx={12} fill={c.main} />
    <rect x={50} y={104} width={28} height={8} rx={4} fill={c.dark} />
    <path d="M64 24 V10" stroke={c.dark} strokeWidth={4} strokeLinecap="round" />
    <circle cx={64} cy={9} r={6} fill={c.accent} />
    <rect x={14} y={48} width={14} height={28} rx={6} fill={c.dark} />
    <rect x={100} y={48} width={14} height={28} rx={6} fill={c.dark} />
    <rect x={24} y={24} width={80} height={68} rx={20} fill={c.main} />
    <rect x={34} y={36} width={60} height={42} rx={14} fill={c.dark} />
    <circle cx={51} cy={55} r={7.5} fill={c.accent} />
    <circle cx={77} cy={55} r={7.5} fill={c.accent} />
    <circle cx={53} cy={52.6} r={2.4} fill={WHITE} opacity={0.85} />
    <circle cx={79} cy={52.6} r={2.4} fill={WHITE} opacity={0.85} />
    <path d="M52 70 H76" stroke={c.accent} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
    <circle cx={40} cy={86} r={2.4} fill={c.light} />
    <circle cx={88} cy={86} r={2.4} fill={c.light} />
  </>
)

const alien: Draw = (c) => (
  <>
    <Torso fill={c.dark} />
    <path d="M52 28 L44 8 M76 28 L84 8" stroke={c.main} strokeWidth={4} strokeLinecap="round" />
    <circle cx={44} cy={8} r={5} fill={c.accent} />
    <circle cx={84} cy={8} r={5} fill={c.accent} />
    <path
      d="M64 24 C96 24 110 52 102 76 C96 94 80 102 64 102 C48 102 32 94 26 76 C18 52 32 24 64 24 Z"
      fill={c.main}
    />
    <ellipse cx={46} cy={62} rx={13} ry={17} fill={INK} transform="rotate(24 46 62)" />
    <ellipse cx={82} cy={62} rx={13} ry={17} fill={INK} transform="rotate(-24 82 62)" />
    <ellipse
      cx={41}
      cy={56}
      rx={4}
      ry={5.4}
      fill={WHITE}
      transform="rotate(24 41 56)"
      opacity={0.9}
    />
    <ellipse
      cx={87}
      cy={56}
      rx={4}
      ry={5.4}
      fill={WHITE}
      transform="rotate(-24 87 56)"
      opacity={0.9}
    />
    <path
      d="M56 86 Q64 91 72 86"
      fill="none"
      stroke={INK}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
    <ellipse cx={61} cy={76} rx={1.2} ry={1.8} fill={c.dark} />
    <ellipse cx={67} cy={76} rx={1.2} ry={1.8} fill={c.dark} />
  </>
)

const ghost: Draw = (c) => (
  <>
    <path
      d="M20 134 L20 62 C20 36 40 20 64 20 C88 20 108 36 108 62 L108 134 Q97 122 86 134 Q75 122 64 134 Q53 122 42 134 Q31 122 20 134 Z"
      fill={c.main}
    />
    <path
      d="M20 90 Q12 96 14 108 Q20 100 24 96 Z M108 90 Q116 96 114 108 Q108 100 104 96 Z"
      fill={c.main}
    />
    <ellipse cx={49} cy={62} rx={6} ry={9.5} fill={INK} />
    <ellipse cx={79} cy={62} rx={6} ry={9.5} fill={INK} />
    <ellipse cx={47.4} cy={58.6} rx={2} ry={2.8} fill={WHITE} />
    <ellipse cx={77.4} cy={58.6} rx={2} ry={2.8} fill={WHITE} />
    <ellipse cx={64} cy={82} rx={6} ry={7.5} fill={INK} />
    <ellipse cx={64} cy={86} rx={3.6} ry={3.4} fill={c.accent} />
    <Cheeks y={76} gap={64} rx={7} ry={4.6} color={c.accent} opacity={0.6} />
  </>
)

/* ---------- catalogue ---------- */

export const CHARACTERS = {
  frog: {
    bg: 'sun',
    draw: frog,
    variants: [
      p('#5cc45e', '#2c7a3a', '#c9f0a8', '#ff9fb0'),
      p('#2fb5a3', '#16706a', '#b8f0e2', '#ffb48a'),
      p('#ff7aa8', '#b33a6c', '#ffd0e0', '#ffe27a'),
      p('#ffa23d', '#b4561a', '#ffe0a8', '#ff6f5e'),
    ],
  },
  penguin: {
    bg: 'sky',
    draw: penguin,
    variants: [
      p('#2e3447', '#1a1f2e', '#ffffff', '#ff9d2e'),
      p('#3f4d86', '#222c5c', '#f4f1ff', '#ffb52e'),
      p('#5b4a44', '#33261f', '#fff3e6', '#ff7a2e'),
      p('#e07aa8', '#a64372', '#fff0f6', '#ffc02e'),
    ],
  },
  pig: {
    bg: 'sage',
    draw: pig,
    variants: [
      p('#ffb0c4', '#f08aa4', '#ff8fae', '#ff8fae'),
      p('#f7c9a8', '#e0a07a', '#f2a885', '#f2a885'),
      p('#c9a0e0', '#a678c4', '#b684d4', '#b684d4'),
      p('#a9d3ff', '#7fb0e8', '#86bbf0', '#86bbf0'),
    ],
  },
  cat: {
    bg: 'lavender',
    draw: cat,
    variants: [
      p('#ff9a3d', '#c4601a', '#ffe9c9', '#ff8fa6'),
      p('#8d96a8', '#5c6579', '#e8ecf4', '#ff9db4'),
      p('#3a3548', '#1f1a2c', '#7c7690', '#ff8fa6'),
      p('#f5efe6', '#c9b9a3', '#ffffff', '#ffb0c0'),
    ],
  },
  dog: {
    bg: 'peach',
    draw: dog,
    variants: [
      p('#e8b26a', '#9a5f2a', '#fff0d6', '#ff7d8e'),
      p('#8a5a3a', '#4d2f1c', '#d9b48f', '#ff7d8e'),
      p('#3c3a46', '#22202b', '#ddd7e8', '#ff7d8e'),
      p('#f2ece2', '#4a4658', '#ffffff', '#ff7d8e'),
    ],
  },
  fox: {
    bg: 'mint',
    draw: fox,
    variants: [
      p('#ff7a2e', '#3a2418', '#fff4e6', '#ff7a2e'),
      p('#e9eef7', '#46506a', '#ffffff', '#e9eef7'),
      p('#9aa3b5', '#2c3144', '#eef1f7', '#9aa3b5'),
      p('#c8472f', '#2a1610', '#ffe9d8', '#c8472f'),
    ],
  },
  bear: {
    bg: 'cream',
    draw: bear,
    variants: [
      p('#a8704a', '#6b4128', '#e6c9a8', '#d48a8a'),
      p('#4a4452', '#2a2530', '#a9a1b8', '#d48a98'),
      p('#f4f0ea', '#cfc4b4', '#ffffff', '#ffb0b8'),
      p('#d9a05a', '#8f5e22', '#f6dcae', '#e89a8a'),
    ],
  },
  panda: {
    bg: 'mint',
    draw: panda,
    variants: [
      p('#ffffff', '#2d2a36', '#f6f6f6', '#ff9aa8'),
      p('#fff6e0', '#4a3a2a', '#fff6e0', '#ff9a8a'),
      p('#eaf2ff', '#2a3a66', '#f4f8ff', '#ff9ab0'),
      p('#ffeef6', '#5a2a4a', '#fff4f9', '#ff8fb0'),
    ],
  },
  rabbit: {
    bg: 'pink',
    draw: rabbit,
    variants: [
      p('#f4f1f6', '#c8bcd0', '#ffffff', '#ffa3b8'),
      p('#b9a99a', '#7d6a5c', '#efe4da', '#ff9fb0'),
      p('#8a6a52', '#4f3a2a', '#d9bca2', '#ff9fb0'),
      p('#4a4658', '#2a2634', '#9d97ae', '#ff9ab0'),
    ],
  },
  koala: {
    bg: 'sky',
    draw: koala,
    variants: [
      p('#a7aebc', '#6a7284', '#eef0f5', '#c7ccd8'),
      p('#8fa6c8', '#586d94', '#e6eef9', '#b5c6e0'),
      p('#b9a08a', '#7f6552', '#f1e6da', '#d4c0ae'),
      p('#c8b8d8', '#8a76a4', '#f2ecf8', '#dccfe8'),
    ],
  },
  tiger: {
    bg: 'sage',
    draw: tiger,
    variants: [
      p('#ff9a2e', '#2f2018', '#fff2dc', '#ff7d8e'),
      p('#f4f0ea', '#4a4658', '#ffffff', '#ff9fae'),
      p('#e8b64a', '#6a4418', '#fff0c8', '#ff8f8f'),
      p('#8a5fb4', '#2f2048', '#f0e6fb', '#ff8fb8'),
    ],
  },
  lion: {
    bg: 'sun',
    draw: lion,
    variants: [
      p('#f2b24a', '#a8601e', '#ffe9b8', '#ff9a8f'),
      p('#c98a5a', '#5f3a22', '#f2d4b4', '#ff9a8f'),
      p('#f4ecdc', '#c8a96a', '#ffffff', '#ffb09a'),
      p('#a9b0c4', '#4a5270', '#e8ecf6', '#ffa0b0'),
    ],
  },
  owl: {
    bg: 'night',
    draw: owl,
    variants: [
      p('#9a6a44', '#5a3a22', '#f0dcc0', '#ffc43a'),
      p('#8a93a6', '#4a5266', '#e8ecf4', '#ffb52e'),
      p('#f2eee6', '#a89a86', '#ffffff', '#ffb02e'),
      p('#6a5aa8', '#38306a', '#e6e0fb', '#ffc83a'),
    ],
  },
  monkey: {
    bg: 'peach',
    draw: monkey,
    variants: [
      p('#9a6a44', '#5a3a22', '#f2d6b8', '#ff9a8a'),
      p('#6a6272', '#3a3442', '#d8d2e0', '#ff9a9a'),
      p('#d9a25a', '#8a5a22', '#fae4b8', '#ff9a8a'),
      p('#3e3a48', '#1f1c28', '#b0a8c0', '#ff9a9a'),
    ],
  },
  raccoon: {
    bg: 'lavender',
    draw: raccoon,
    variants: [
      p('#9aa0ae', '#2f3040', '#f2f4f8', '#ffa0b0'),
      p('#a8825c', '#3f2c1c', '#f4e6d4', '#ffa0a0'),
      p('#7a8ab4', '#262c4a', '#eef2fb', '#ffa0b8'),
      p('#c4b6a0', '#4a3a2c', '#fbf6ee', '#ffa8a0'),
    ],
  },
  unicorn: {
    bg: 'lavender',
    draw: unicorn,
    variants: [
      p('#ffffff', '#b8a4d8', '#ffeaf4', '#ff9acb'),
      p('#f6f0ff', '#9a8ad8', '#efe6ff', '#9ab4ff'),
      p('#effaf4', '#7ac4a8', '#e2f7ee', '#7fd8c8'),
      p('#fff4e6', '#e0a878', '#ffead2', '#ffb07a'),
    ],
  },
  chick: {
    bg: 'sky',
    draw: chick,
    variants: [
      p('#ffd84a', '#e0a21a', '#fff0a8', '#ff9a2e'),
      p('#fff3c8', '#e0c070', '#fffbe8', '#ffa03a'),
      p('#ffb46a', '#d4782a', '#ffe0b8', '#ff6f4a'),
      p('#9ad8ff', '#4a9ad8', '#d6f0ff', '#ffb03a'),
    ],
  },
  robot: {
    bg: 'night',
    draw: robot,
    variants: [
      p('#c4ccda', '#2e3447', '#e8ecf4', '#5ad8ff'),
      p('#6a8aff', '#222c66', '#b8c8ff', '#ffe05a'),
      p('#5ac4a0', '#1a4a3e', '#b8f0dc', '#ff7ab0'),
      p('#ff8a6a', '#4a2218', '#ffd0c0', '#5ad8ff'),
    ],
  },
  alien: {
    bg: 'night',
    draw: alien,
    variants: [
      p('#8ae04a', '#3a7a22', '#ccf4a0', '#ff7ac4'),
      p('#b48aff', '#5a3aa8', '#ddc8ff', '#7affc8'),
      p('#5ac8ff', '#1f6aa8', '#b8e8ff', '#ffe07a'),
      p('#ff8ac4', '#a83a78', '#ffc8e4', '#7affd8'),
    ],
  },
  ghost: {
    bg: 'night',
    draw: ghost,
    variants: [
      p('#f6f4ff', '#c8c0e8', '#ffffff', '#ffa8c4'),
      p('#d8f2ff', '#8ac4e8', '#f0fbff', '#ffb0c8'),
      p('#ffe6f2', '#e8a0c4', '#fff4f9', '#ff9ac0'),
      p('#e0ffe8', '#8ad4a0', '#f2fff6', '#ffa8b8'),
    ],
  },
} satisfies Record<string, Character>

export type AvatarId = keyof typeof CHARACTERS
export const AVATAR_IDS = Object.keys(CHARACTERS) as AvatarId[]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && value in CHARACTERS
}

export function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === 'string' && value in AVATAR_BACKGROUNDS
}

export const variantCount = (id: AvatarId) => CHARACTERS[id].variants.length

export function characterPalette(id: AvatarId, variant = 0): Palette {
  const { variants } = CHARACTERS[id]
  return variants[variant] ?? variants[0]
}

export function defaultBackground(id: AvatarId): BackgroundId {
  return CHARACTERS[id].bg
}

/** The whole avatar: coloured disc plus the character, as one square SVG. */
export function AvatarFigure({
  id,
  bg,
  variant = 0,
  className,
}: {
  id: AvatarId
  bg?: BackgroundId
  variant?: number
  className?: string
}) {
  const character: Character = CHARACTERS[id]
  const palette = characterPalette(id, variant)
  const fill = AVATAR_BACKGROUNDS[bg ?? character.bg]
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={className} focusable="false">
      <rect width={128} height={128} fill={fill} />
      <circle cx={64} cy={58} r={62} fill={WHITE} opacity={0.14} />
      {character.draw(palette)}
    </svg>
  )
}
