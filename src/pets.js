import { colors } from './theme';
import { parseYmd, toYmd } from './date';

// 02_MVP_Requirement §2 "계정당 최대 5마리". 펫 전환 메뉴와 MY 화면이 모두
// 이 상한을 걸어야 해서 한 곳에 둔다.
export const MAX_PETS = 5;

// Species → presentation. Kept out of stored pet data so it stays derivable.
export function speciesMeta(species) {
  return species === 'cat'
    ? { icon: 'cat', bg: '#E9F1F8', fg: colors.blue, label: '고양이' }
    : { icon: 'dog', bg: colors.peach, fg: colors.primary, label: '강아지' };
}

// Whole-years age from a birthDate (YYYY-MM-DD); estimated dates still work.
export function ageYears(birthDate) {
  if (!birthDate) return null;
  const b = parseYmd(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) y--;
  return Math.max(0, y);
}

// birthDate string for a given estimated age in years.
export function birthDateFromAge(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return toYmd(d); // local calendar — toISOString() would shift a day east of UTC
}

export function petSubtitle(pet) {
  const { label } = speciesMeta(pet.species);
  const age = ageYears(pet.birthDate);
  return age == null ? label : `${label} · ${age}살`;
}
