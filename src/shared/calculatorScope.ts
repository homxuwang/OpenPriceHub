import type { ManualCategory } from './manualCompare';
export function calculatorCategory(value: string | null): ManualCategory | null {
  const aliases: Record<string, ManualCategory> = { image: 'image', video: 'video', voice: 'tts', tts: 'tts', music: 'music', api: 'text', 'llm-api': 'text', text: 'text', audio: 'audio' };
  return value && Object.hasOwn(aliases, value) ? aliases[value] : null;
}
