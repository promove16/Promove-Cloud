export const CURRICULUM_PDF_POINTS = 20;
export const CURRICULUM_CLASS_PHOTO_POINTS = 20;

/**
 * Distribute the class-photo half of curriculum mapping deterministically.
 * The first `remainder` classes receive one extra point, so approving every
 * planned class always totals exactly 20 points without rounding drift.
 */
export const getClassPhotoPoints = (
  plannedClassesCount: number,
  classIndex: number,
): number => {
  const basePoints = Math.floor(CURRICULUM_CLASS_PHOTO_POINTS / plannedClassesCount);
  const remainder = CURRICULUM_CLASS_PHOTO_POINTS % plannedClassesCount;
  return basePoints + (classIndex <= remainder ? 1 : 0);
};
