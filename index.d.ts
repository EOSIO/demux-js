declare module "demux-js"

export const handlers: any
export const readers: any
export const watchers: any

export interface Block {
  actions: Action[]
  blockHash: string
  blockNumber: number
  previousBlockHash: string
}

export interface BlockInfo {
  blockNumber: number
  blockHash: string
  previousBlockHash: string
}

export interface Action {
  type: string
  payload: any
}

export interface Updater {
  actionType: string
  updater: (data: any) => void
}

export interface Effect {
  actionType: string
  effect: (data: any) => void
}
