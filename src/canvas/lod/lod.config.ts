/** 语义缩放的阈值集中在这里，改行为只改这一个文件 */
export const LOD_THRESHOLDS = {
  /** 低于此值只看模块群岛 */
  galaxy: 0.3,
  /** 低于此值看模块内核与泳道 */
  module: 0.62,
  /** 低于此值看步骤卡片（紧凑） */
  process: 1.15,
} as const

export const LOD_LABEL = ['星系', '模块', '流程', '步骤'] as const

export function lodFromZoom(zoom: number): number {
  if (zoom < LOD_THRESHOLDS.galaxy) return 0
  if (zoom < LOD_THRESHOLDS.module) return 1
  if (zoom < LOD_THRESHOLDS.process) return 2
  return 3
}
