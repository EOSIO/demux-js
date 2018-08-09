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

export interface IndexState {
  blockNumber: number
  blockHash: string
}

export interface BlockInfo {
  blockHash: string
  blockNumber: number
  previousBlockHash: string
}

export interface Action {
  type: string
  payload: any
}

export interface Transaction {
  status: string
  cpu_usage_us: number
  net_usage_words: number
  trx: Trx
}
export interface Trx {
  id: string
  compression: string
  packed_context_free_data: string
  context_free_data: any[]
  transaction: TransactionContent
}

export interface TransactionContent {
  expiration: string
  ref_block_num: number
  ref_block_prefix: number
  max_net_usage_words: number
  max_cpu_usage_ms: number
  delay_sec: number
  context_free_actions: any[]
  actions: Action[]
  transaction_extensions: any[]
}

export interface Updater {
  actionType: string
  updater: (state: any, payload: any, blockInfo: BlockInfo, context: any) => void
}

export interface Effect {
  actionType: string
  effect: (state: any, payload: any, blockInfo: BlockInfo, context: any) => void
}
