import React from 'react';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Maps the design's Tabler icon names to the closest @expo/vector-icons glyphs.
// [family, glyph] — 'mci' = MaterialCommunityIcons, 'ion' = Ionicons.
const MAP = {
  dog: ['mci', 'dog'],
  cat: ['mci', 'cat'],
  paw: ['mci', 'paw'],
  meal: ['mci', 'bowl-mix'],
  poop: ['mci', 'emoticon-poop'],
  pee: ['mci', 'water'],
  walk: ['mci', 'walk'],
  vomit: ['mci', 'emoticon-sick-outline'],
  condition: ['mci', 'emoticon-happy-outline'],
  weight: ['mci', 'scale-bathroom'],
  memo: ['mci', 'note-text-outline'],
  camera: ['mci', 'camera-outline'],
  dots: ['mci', 'dots-horizontal'],
  vaccine: ['mci', 'needle'],
  stethoscope: ['mci', 'stethoscope'],
  checks: ['mci', 'check-all'],
  check: ['mci', 'check'],
  bell: ['ion', 'notifications-outline'],
  user: ['ion', 'person-outline'],
  'file-text': ['ion', 'document-text-outline'],
  'message-circle': ['ion', 'chatbubble-ellipses-outline'],
  cake: ['mci', 'cake-variant-outline'],
  venus: ['mci', 'gender-female'],
  plus: ['ion', 'add'],
  minus: ['ion', 'remove'],
  x: ['ion', 'close'],
  'arrow-left': ['ion', 'arrow-back'],
  'chevron-down': ['ion', 'chevron-down'],
  'chevron-up': ['ion', 'chevron-up'],
  'chevron-right': ['ion', 'chevron-forward'],
  'chevron-left': ['ion', 'chevron-back'],
  home: ['ion', 'home'],
  calendar: ['ion', 'calendar-outline'],
  chart: ['ion', 'stats-chart'],
  edit: ['mci', 'pencil-outline'],
};

export default function Icon({ name, size = 20, color = '#2A2521', style }) {
  const entry = MAP[name] || ['mci', 'help-circle-outline'];
  const [family, glyph] = entry;
  const Cmp = family === 'ion' ? Ionicons : MaterialCommunityIcons;
  return <Cmp name={glyph} size={size} color={color} style={style} />;
}
