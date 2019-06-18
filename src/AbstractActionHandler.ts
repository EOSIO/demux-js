import { BunyanProvider, Logger } from './BunyanProvider'
import {
  DuplicateHandlerVersionError,
  MismatchedBlockHashError,
  MissingHandlerVersionError,
} from './errors'
import {
  Action,
  ActionReaderOptions,
  DeferredEffects,
  Effect,
  EffectRunMode,
  HandlerInfo,
  HandlerVersion,
  IndexState,
  NextBlock,
  VersionedAction,
} from './interfaces'
import { LogLevel } from 'bunyan'

/**
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through the
 * `Updater`s and `Effect`s of the current `HandlerVersion`. Pass an object exposing a persistence API as `state` to the
 * `handleWithState` method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`. Implement `rollbackTo` to handle when a fork is encountered.
 *
 */
export abstract class AbstractActionHandler {
  public lastProcessedBlockNumber: number = 0
  public lastProcessedBlockHash: string = ''
  public handlerVersionName: string = 'v1'
  protected log: Logger
  protected effectRunMode: EffectRunMode
  protected initialized: boolean = false
  private deferredEffects: DeferredEffects = {}
  private handlerVersionMap: { [versionName: string]: HandlerVersion } = {}

  /**
   * @param handlerVersions  An array of `HandlerVersion`s that are to be used when processing blocks. The default
   *                         version name is `"v1"`.
   *
   * @param effectRunMode    An EffectRunMode that describes what effects should be run.
   * @param options
   */
  constructor(
    handlerVersions: HandlerVersion[],
    options?: ActionReaderOptions,
  ) {
    const optionsWithDefaults = {
      effectRunMode: EffectRunMode.All,
      logLevel: 'info' as LogLevel,
      ...options,
    }
    this.initHandlerVersions(handlerVersions)
    this.effectRunMode = optionsWithDefaults.effectRunMode
    this.log = BunyanProvider.getLogger()
    this.log.level(optionsWithDefaults.logLevel)
  }

  /**
   * Receive block, validate, and handle actions with updaters and effects
   */
  public async handleBlock(
    nextBlock: NextBlock,
    isReplay: boolean,
  ): Promise<number | null> {
    const { block, blockMeta } = nextBlock
    const { blockInfo } = block
    const { isRollback, isEarliestBlock } = blockMeta

    if (!this.initialized) {
      await this.initialize()
    }

    await this.handleRollback(isRollback, blockInfo.blockNumber, isReplay, isEarliestBlock)

    const nextBlockNeeded = this.lastProcessedBlockNumber + 1

    // Just processed this block; skip
    if (blockInfo.blockNumber === this.lastProcessedBlockNumber
        && blockInfo.blockHash === this.lastProcessedBlockHash) {
      return null
    }

    // If it's the first block but we've already processed blocks, seek to next block
    if (isEarliestBlock && this.lastProcessedBlockHash) {
      return nextBlockNeeded
    }
    // Only check if this is the block we need if it's not the first block
    if (!isEarliestBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return nextBlockNeeded
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this.lastProcessedBlockHash) {
        const err = new MismatchedBlockHashError()
        throw err
      }
    }

    const handleWithArgs: (state: any, context?: any) => Promise<void> = async (state: any, context: any = {}) => {
      await this.handleActions(state, context, nextBlock, isReplay)
    }
    await this.handleWithState(handleWithArgs)
    return null
  }

  /**
   * Information about the current state of the Action Handler
   */
  public get info(): HandlerInfo {
    return {
      lastProcessedBlockNumber: this.lastProcessedBlockNumber,
      lastProcessedBlockHash: this.lastProcessedBlockHash,
      handlerVersionName: this.handlerVersionName,
    }
  }

  /**
   * Performs all required initialization for the handler.
   */
  public async initialize(): Promise<void> {
    await this.setup()
    await this.refreshIndexState()
    this.initialized = true
  }

  /**
   * Updates the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state, coinciding with the block
   * that has just been processed. These are the same values read by `updateIndexState()`.
   */
  protected abstract async updateIndexState(
    state: any,
    nextBlock: NextBlock,
    isReplay: boolean,
    handlerVersionName: string,
    context?: any,
  ): Promise<void>

  /**
   * Returns a promise for the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state,
   * coinciding with the block that has just been processed.
   * These are the same values written by `updateIndexState()`.
   * @returns A promise that resolves to an `IndexState`
   */
  protected abstract async loadIndexState(): Promise<IndexState>

  /**
   * Must call the passed-in `handle` function within this method, passing in a state object that will be passed in to
   * the `state` parameter to all calls of `Updater.apply`. Optionally, pass in a `context` object as a second
   * parameter, which can be utilized to share state across `Updater.apply` and `Effect.run` calls on a per-block basis.
   */
  protected abstract async handleWithState(handle: (state: any, context?: any) => void): Promise<void>

  /**
   * Idempotently performs any required setup.
   */
  protected abstract async setup(): Promise<void>

  /**
   * This method is used when matching the types of incoming actions against the types the `Updater`s and `Effect`s are
   * subscribed to. When this returns true, their corresponding functions will run.
   *
   * By default, this method tests for direct equivalence between the incoming candidate type and the type that is
   * subscribed. Override this method to extend this functionality (e.g. wildcards).
   *
   * @param candidateType   The incoming action's type
   * @param subscribedType  The type the Updater of Effect is subscribed to
   * @param _payload        The payload of the incoming Action.
   */
  protected matchActionType(candidateType: string, subscribedType: string, _payload?: any): boolean { // tslint:disable-line
    return candidateType === subscribedType
  }

  /**
   * Process actions against deterministically accumulating `Updater` functions. Returns a promise of versioned actions
   * for consumption by `runEffects`, to make sure the correct effects are run on blocks that include a `HandlerVersion`
   * change. To change a `HandlerVersion`, have an `Updater` function return the `versionName` of the corresponding
   * `HandlerVersion` you want to change to.
   */
  protected async applyUpdaters(
    state: any,
    nextBlock: NextBlock,
    context: any,
    isReplay: boolean,
  ): Promise<VersionedAction[]> {
    const versionedActions = [] as VersionedAction[]
    const { block: { actions, blockInfo } } = nextBlock
    for (const action of actions) {
      let updaterIndex = -1
      for (const updater of this.handlerVersionMap[this.handlerVersionName].updaters) {
        updaterIndex += 1
        if (this.matchActionType(action.type, updater.actionType, action.payload)) {
          const { payload } = action
          const newVersion = await updater.apply(state, payload, blockInfo, context)
          if (newVersion && !this.handlerVersionMap.hasOwnProperty(newVersion)) {
            this.warnHandlerVersionNonexistent(newVersion)
          } else if (newVersion) {
            this.log.info(`BLOCK ${blockInfo.blockNumber}: Updating Handler Version to '${newVersion}'`)
            this.warnSkippingUpdaters(updaterIndex, action.type)
            await this.updateIndexState(state, nextBlock, isReplay, newVersion, context)
            this.handlerVersionName = newVersion
            break
          }
        }
      }
      versionedActions.push({
        action,
        handlerVersionName: this.handlerVersionName,
      })
    }
    return versionedActions
  }

  /**
   * Process versioned actions against asynchronous side effects.
   */
  protected runEffects(
    versionedActions: VersionedAction[],
    context: any,
    nextBlock: NextBlock,
  ) {
    this.runDeferredEffects(nextBlock.lastIrreversibleBlockNumber)
    for (const { action, handlerVersionName } of versionedActions) {
      for (const effect of this.handlerVersionMap[handlerVersionName].effects) {
        if (this.shouldRunOrDeferEffect(effect, action)) {
          this.runOrDeferEffect(effect, action.payload, nextBlock, context)
        }
      }
    }
  }

  /**
   * Will run when a rollback block number is passed to handleActions. Implement this method to
   * handle reversing actions full blocks at a time, until the last applied block is the block
   * number passed to this method.
   */
  protected abstract async rollbackTo(blockNumber: number): Promise<void>

  /**
   * Calls `applyUpdaters` and `runEffects` on the given actions
   */
  protected async handleActions(
    state: any,
    context: any,
    nextBlock: NextBlock,
    isReplay: boolean,
  ): Promise<void> {
    const { block } = nextBlock
    const { blockInfo } = block

    const versionedActions = await this.applyUpdaters(state, nextBlock, context, isReplay)
    if (!isReplay) {
      this.runEffects(versionedActions, context, nextBlock)
    }

    await this.updateIndexState(state, nextBlock, isReplay, this.handlerVersionName, context)
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
  }

  private async handleRollback(isRollback: boolean, blockNumber: number, isReplay: boolean, isEarliestBlock: boolean) {
    if (isRollback || (isReplay && isEarliestBlock)) {
      const rollbackBlockNumber = blockNumber - 1
      const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber
      this.log.info(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`)
      await this.rollbackTo(rollbackBlockNumber)
      this.rollbackDeferredEffects(blockNumber)
      await this.refreshIndexState()
    } else if (this.lastProcessedBlockNumber === 0 && this.lastProcessedBlockHash === '') {
      await this.refreshIndexState()
    }
  }

  private range(start: number, end: number) {
    return Array(end - start).fill(0).map((_, i: number) => i + start)
  }

  protected runOrDeferEffect(
    effect: Effect,
    payload: any,
    nextBlock: NextBlock,
    context: any,
  ) {
    const { block, lastIrreversibleBlockNumber } = nextBlock
    const { blockInfo } = block
    const shouldRunImmediately = (
      !effect.deferUntilIrreversible || blockInfo.blockNumber <= lastIrreversibleBlockNumber
    )
    if (shouldRunImmediately) {
      effect.run(payload, blockInfo, context)
    } else {
      if (!this.deferredEffects[blockInfo.blockNumber]) {
        this.deferredEffects[blockInfo.blockNumber] = []
      }
      this.deferredEffects[blockInfo.blockNumber].push(() => effect.run(payload, blockInfo, context))
    }
  }

  protected shouldRunOrDeferEffect(effect: Effect, action: Action) {
    if (!this.matchActionType(action.type, effect.actionType, action.payload)) {
      return false
    } else if (this.effectRunMode === EffectRunMode.None) {
      return false
    } else if (this.effectRunMode === EffectRunMode.OnlyImmediate && effect.deferUntilIrreversible) {
      return false
    } else if (this.effectRunMode === EffectRunMode.OnlyDeferred && !effect.deferUntilIrreversible) {
      return false
    }
    return true
  }

  private runDeferredEffects(lastIrreversibleBlockNumber: number) {
    const nextDeferredBlockNumber = this.getNextDeferredBlockNumber()
    if (!nextDeferredBlockNumber) { return }
    for (const blockNumber of this.range(nextDeferredBlockNumber, lastIrreversibleBlockNumber + 1)) {
      if (this.deferredEffects[blockNumber]) {
        const effects = this.deferredEffects[blockNumber]
        for (const deferredEffect of effects) {
          deferredEffect()
        }
        delete this.deferredEffects[blockNumber]
      }
    }
  }

  private getNextDeferredBlockNumber() {
    const blockNumbers = Object.keys(this.deferredEffects).map((num) => parseInt(num, 10))
    if (blockNumbers.length === 0) {
      return 0
    }
    return Math.min(...blockNumbers)
  }

  private rollbackDeferredEffects(rollbackTo: number) {
    const blockNumbers = Object.keys(this.deferredEffects).map((num) => parseInt(num, 10))
    const toRollBack = blockNumbers.filter((bn) => bn >= rollbackTo)
    for (const blockNumber of toRollBack) {
      delete this.deferredEffects[blockNumber]
    }
  }

  private initHandlerVersions(handlerVersions: HandlerVersion[]) {
    if (handlerVersions.length === 0) {
      throw new MissingHandlerVersionError()
    }
    for (const handlerVersion of handlerVersions) {
      if (this.handlerVersionMap.hasOwnProperty(handlerVersion.versionName)) {
        throw new DuplicateHandlerVersionError(handlerVersion.versionName)
      }
      this.handlerVersionMap[handlerVersion.versionName] = handlerVersion
    }
    if (!this.handlerVersionMap.hasOwnProperty(this.handlerVersionName)) {
      this.handlerVersionName = handlerVersions[0].versionName
      this.warnMissingHandlerVersion(handlerVersions[0].versionName)
    } else if (handlerVersions[0].versionName !== 'v1') {
      this.warnIncorrectFirstHandler(handlerVersions[0].versionName)
    }
  }

  private async refreshIndexState() {
    const { blockNumber, blockHash, handlerVersionName } = await this.loadIndexState()
    this.lastProcessedBlockNumber = blockNumber
    this.lastProcessedBlockHash = blockHash
    this.handlerVersionName = handlerVersionName
  }

  private warnMissingHandlerVersion(actualVersion: string) {
    this.log.warn(`No Handler Version found with name '${this.handlerVersionName}': starting with ` +
      `'${actualVersion}' instead.`)
  }

  private warnIncorrectFirstHandler(actualVersion: string) {
    this.log.warn(`First Handler Version '${actualVersion}' is not '${this.handlerVersionName}', ` +
      `and there is also '${this.handlerVersionName}' present. Handler Version ` +
      `'${this.handlerVersionName}' will be used, even though it is not first.`)
  }

  private warnHandlerVersionNonexistent(newVersion: string) {
    this.log.warn(`Attempted to switch to handler version '${newVersion}', however this version ` +
      `does not exist. Handler will continue as version '${this.handlerVersionName}'`)
  }

  private warnSkippingUpdaters(updaterIndex: number, actionType: string) {
    const remainingUpdaters = this.handlerVersionMap[this.handlerVersionName].updaters.length - updaterIndex - 1
    if (remainingUpdaters) {
      this.log.warn(`Handler Version was updated to version '${this.handlerVersionName}' while there ` +
        `were still ${remainingUpdaters} updaters left! These updaters will be skipped for the ` +
        `current action '${actionType}'.`)
    }
  }
}
