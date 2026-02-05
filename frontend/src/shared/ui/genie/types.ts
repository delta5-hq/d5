export type GenieState = 'idle' | 'busy' | 'busy-alert' | 'done-success' | 'done-failure'

export interface TgsPlayerInstance {
  play: () => void
  stop: () => void
  pause: () => void
  totalFrames: number
  frameRate: number
  currentFrame: number
  isPlaying: boolean
}
