import { LogLevel } from './BunyanProvider'

export interface ActionReader {
  getNextBlock(): Promise<NextBlock>
  initialize(): Promise<void>
  seekToBlock(blockNumber: number): Promise<void>
  readonly info: ReaderInfo
}

export interface LogOptions {
  logSource?: string
  logLevel?: LogLevel
}

export interface ActionReaderOptions extends LogOptions {
  /**
   * For positive values, this sets the first block that this will start at. For negative
   * values, this will start at (most recent block + startAtBlock), effectively tailing the
   * chain. Be careful when using this feature, as this will make your starting block dynamic.
   */
  startAtBlock?: number
  /**
   * When false (default), `getHeadBlockNumber` will load the most recent block number. When
   * true, `getHeadBlockNumber` will return the block number of the most recent irreversible
   * block. Keep in mind that `getHeadBlockNumber` is an abstract method and this functionality
   * is the responsibility of the implementing class.
   */
  onlyIrreversible?: boolean
}

export interface ActionWatcherOptions extends LogOptions {
  pollInterval?: number
  velocitySampleSize?: number
}

export interface ExpressActionWatcherOptions extends ActionWatcherOptions {
  port?: number
}

export interface JsonActionReaderOptions extends ActionReaderOptions {
  blockchain: Block[]
}

export interface ActionHandler {
  handleBlock(nextBlock: NextBlock, isReplay: boolean): Promise<number | null>
  initialize(): Promise<void>
  readonly info: HandlerInfo
}

export interface ActionHandlerOptions extends LogOptions {
  effectRunMode?: EffectRunMode
  maxEffectErrors?: number
  validateBlocks?: boolean
}

export interface Block {
  actions: Action[]
  blockInfo: BlockInfo
}

export interface BlockMeta {
  isRollback: boolean
  isEarliestBlock: boolean
  isNewBlock: boolean
}

export interface IndexState {
  blockNumber: number
  lastIrreversibleBlockNumber: number
  blockHash: string
  handlerVersionName: string
  isReplay: boolean
}

export interface BlockInfo {
  blockNumber: number
  blockHash: string
  previousBlockHash: string
  timestamp: Date
}

export interface NextBlock {
  block: Block
  blockMeta: BlockMeta
  lastIrreversibleBlockNumber: number
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
  blockInfo: BlockInfo,
  context: any,
) => void | Promise<void>

export interface Updater extends ActionListener {
  apply: ActionCallback
  revert?: ActionCallback
}

export interface Effect extends ActionListener {
  run: StatelessActionCallback
  deferUntilIrreversible?: boolean
  onRollback?: StatelessActionCallback
}

export interface HandlerVersion {
  versionName: string
  updaters: Updater[]
  effects: Effect[]
}

export interface VersionedAction {
  action: Action
  handlerVersionName: string
}

export type CurriedEffectRun = (
  (currentBlockNumber: number, immediate?: boolean) => Promise<void>
)

export interface DeferredEffects {
  [blockNumber: number]: CurriedEffectRun[]
}

export interface EffectsInfo {
  numberOfRunningEffects: number
  effectErrors: string[]
}

export interface HandlerInfo {
  lastProcessedBlockNumber: number
  lastProcessedBlockHash: string
  lastIrreversibleBlockNumber: number
  handlerVersionName: string
  isReplay?: boolean
  effectRunMode?: EffectRunMode
  numberOfRunningEffects?: number
  effectErrors?: string[]
}

export interface ReaderInfo {
  currentBlockNumber: number
  startAtBlock: number
  headBlockNumber: number
  onlyIrreversible?: boolean
  lastIrreversibleBlockNumber?: number
}

export enum EffectRunMode {
  All = 'all',
  OnlyImmediate = 'onlyImmediate',
  OnlyDeferred = 'onlyDeferred',
  None = 'none',
}

export enum IndexingStatus {
  Initial = 'initial',
  Indexing = 'indexing',
  Pausing = 'pausing',
  Paused = 'paused',
  Stopped = 'stopped',
}

export interface WatcherInfo {
  indexingStatus: IndexingStatus
  error?: Error
  currentBlockVelocity: number
  currentBlockInterval: number
  maxBlockVelocity: number
}

export interface DemuxInfo {
  watcher: WatcherInfo
  handler: HandlerInfo
  reader: ReaderInfo
}
