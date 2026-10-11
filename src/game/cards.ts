import { TrainingCardProvider } from './training-card';
import { PhotoCardProvider } from './photo-card';
export type CardId = 'training-card' | 'photo-2025';
export function getCardProvider(cardId?: string) {
  return cardId === 'photo-2025' ? PhotoCardProvider : TrainingCardProvider;
}
