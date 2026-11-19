export const MIN_VIEWPORT_WIDTH = 1024;
export const MIN_VIEWPORT_HEIGHT = 768;

export function meetsMinimumResolution(width: number, height: number): boolean {
  return width >= MIN_VIEWPORT_WIDTH && height >= MIN_VIEWPORT_HEIGHT;
}
