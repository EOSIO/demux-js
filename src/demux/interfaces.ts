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
  updater: (data: any) => void
}

interface Effect {
  actionType: string
  effect: (data: any) => void
}
