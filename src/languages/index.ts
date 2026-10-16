import type { Language, LanguageId } from './types';
import { python } from './python';
import { javascript } from './javascript';

export type { Language, LanguageId } from './types';

/** 所有支援的語言；新增語言時在這裡登記 */
export const LANGUAGES: Record<LanguageId, Language> = { python, javascript };

export const DEFAULT_LANGUAGE: LanguageId = 'python';

/** 依 id 取得語言；未知或缺少時（例如舊版存下的頁籤）使用預設語言 */
export function getLanguage(id?: string): Language {
  return (id && id in LANGUAGES ? LANGUAGES[id as LanguageId] : LANGUAGES[DEFAULT_LANGUAGE]);
}
