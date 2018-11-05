export interface Block {
  actions: Action[]
  blockInfo: BlockInfo
}

export interface IndexState {
  blockNumber: number
  blockHash: string
  handlerVersionName: string
  isReplay: boolean
}

export interface BlockInfo {
  blockNumber: number
  blockHash: string
  previousBlockHash: string
  lastIrreversibleBlockNumber: number
  lastIrreversibleBlockHash: number
  timestamp: Date
}

export interface Action {
  type: string
  payload: any
}

export interface ActionListener {
  actionType: string
}

export type ActionCallback = (
  state: any,
  payload: any,
  blockInfo: BlockInfo,
  context: any,
) => void | string | Promise<void> | Promise<string>

export type StatelessActionCallback = (
  payload: any,
  block: Block,
  context: any,
) => void | Promise<void>

export interface Updater extends ActionListener {
  apply: ActionCallback
  revert?: ActionCallback
}

export interface Effect extends ActionListener {
  run: StatelessActionCallback
  onRollback?: StatelessActionCallback
}

export interface HandlerVersion {
  versionName: string
  updaters: Updater[]
  effects: Effect[]
}
