interface Block {
  actions: Action[]
  blockHash: string
  blockNumber: number
  previousBlockHash: string
}

interface BlockInfo {
  blockNumber: number
  blockHash: string
  previousBlockHash: string
}

interface Action {
  type: string
  payload: any
}

interface Updater {
  actionType: string
  updater: (state: any, payload: any, blockInfo: BlockInfo, context: any) => void
}

interface Effect {
  actionType: string
  effect: (state: any, payload: any, blockInfo: BlockInfo, context: any) => void
}
