import { BunyanProvider, Logger } from './BunyanProvider'
import {
  DuplicateHandlerVersionError,
  MismatchedBlockHashError,
  MissingHandlerVersionError,
} from './errors'
import {
  Action,
  ActionHandlerOptions,
  BlockInfo,
  CurriedEffectRun,
  DeferredEffects,
  Effect,
  EffectRunMode,
  EffectsInfo,
  HandlerInfo,
  HandlerVersion,
  IndexState,
  NextBlock,
  VersionedAction,
} from './interfaces'
import { QueryablePromise, makeQuerablePromise } from './makeQueryablePromise'
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
  private runningEffects: Array<QueryablePromise<void>> = []
  private effectErrors: string[] = []
  private maxEffectErrors: number

  /**
   * @param handlerVersions  An array of `HandlerVersion`s that are to be used when processing blocks. The default
   *                         version name is `"v1"`.
   *
   * @param options
   */
  constructor(
    handlerVersions: HandlerVersion[],
    options?: ActionHandlerOptions,
  ) {
    const optionsWithDefaults = {
      effectRunMode: EffectRunMode.All,
      logLevel: 'info' as LogLevel,
      maxEffectErrors: 100,
      ...options,
    }
    this.initHandlerVersions(handlerVersions)
    this.effectRunMode = optionsWithDefaults.effectRunMode
    this.maxEffectErrors = optionsWithDefaults.maxEffectErrors
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
      this.log.info('Action Handler was not initialized before started, so it is being initialized now')
      await this.initialize()
    }

    await this.handleRollback(isRollback, blockInfo.blockNumber, isReplay, isEarliestBlock)

    const nextBlockNeeded = this.lastProcessedBlockNumber + 1

    // Just processed this block; skip
    if (blockInfo.blockNumber === this.lastProcessedBlockNumber
        && blockInfo.blockHash === this.lastProcessedBlockHash) {
      this.log.debug(`Block ${blockInfo.blockNumber} was just handled; skipping`)
      return null
    }

    // If it's the first block but we've already processed blocks, seek to next block
    if (isEarliestBlock && this.lastProcessedBlockHash) {
      return nextBlockNeeded
    }
    // Only check if this is the block we need if it's not the first block
    if (!isEarliestBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        this.log.debug(
          `Got block ${blockInfo.blockNumber} but block ${nextBlockNeeded} is needed; ` +
          `requesting block ${nextBlockNeeded}`
        )
        return nextBlockNeeded
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this.lastProcessedBlockHash) {
        throw new MismatchedBlockHashError()
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
    const effectInfo = this.checkRunningEffects()
    return {
      lastProcessedBlockNumber: this.lastProcessedBlockNumber,
      lastProcessedBlockHash: this.lastProcessedBlockHash,
      handlerVersionName: this.handlerVersionName,
      effectRunMode: this.effectRunMode,
      numberOfRunningEffects: effectInfo.numberOfRunningEffects,
      effectErrors: effectInfo.effectErrors,
    }
  }

  /**
   * Performs all required initialization for the handler.
   */
  public async initialize(): Promise<void> {
    this.log.debug('Initializing Action Handler...')
    const setupStart = Date.now()
    await this.setup()
    const betweenSetupAndIndexState = Date.now()
    await this.refreshIndexState()
    this.initialized = true
    const setupTime = betweenSetupAndIndexState - setupStart
    const indexStateTime = Date.now() - betweenSetupAndIndexState
    const initializeTime = setupTime + indexStateTime
    this.log.debug(
      `Initialized Action Handler (${setupTime}ms setup + ${indexStateTime}ms index state = ${initializeTime}ms)`
    )
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
          this.log.debug(`Applying updater for action type '${action.type}'...`)
          const updaterStart = Date.now()
          const newVersion = await updater.apply(state, payload, blockInfo, context)
          const updaterTime = Date.now() - updaterStart
          this.log.debug(`Applied updater for action type '${action.type}' (${updaterTime}ms)`)
          if (newVersion && !this.handlerVersionMap.hasOwnProperty(newVersion)) {
            this.warnHandlerVersionNonexistent(newVersion)
          } else if (newVersion) {
            this.log.info(`Updated Handler Version to '${newVersion}' (block ${blockInfo.blockNumber})`)
            this.warnSkippingUpdaters(updaterIndex, action.type)
            await this.loggedUpdateIndexState(state, nextBlock, isReplay, newVersion, context)
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
  protected async runEffects(
    versionedActions: VersionedAction[],
    context: any,
    nextBlock: NextBlock,
  ) {
    await this.runDeferredEffects(nextBlock.lastIrreversibleBlockNumber)
    for (const { action, handlerVersionName } of versionedActions) {
      for (const effect of this.handlerVersionMap[handlerVersionName].effects) {
        if (this.shouldRunOrDeferEffect(effect, action)) {
          await this.runOrDeferEffect(effect, action.payload, nextBlock, context)
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
      await this.runEffects(versionedActions, context, nextBlock)
    }

    await this.loggedUpdateIndexState(state, nextBlock, isReplay, this.handlerVersionName, context)
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
    this.checkRunningEffects()
  }

  private async handleRollback(isRollback: boolean, blockNumber: number, isReplay: boolean, isEarliestBlock: boolean) {
    if (isRollback || (isReplay && isEarliestBlock)) {
      const rollbackBlockNumber = blockNumber - 1
      const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber
      this.log.debug(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`)
      const rollbackStart = Date.now()
      await this.rollbackTo(rollbackBlockNumber)
      this.rollbackDeferredEffects(blockNumber)
      const rollbackTime = Date.now() - rollbackStart
      this.log.info(`Rolled back ${rollbackCount} blocks to block ${rollbackBlockNumber} (${rollbackTime}ms)`)
      await this.refreshIndexState()
    } else if (this.lastProcessedBlockNumber === 0 && this.lastProcessedBlockHash === '') {
      await this.refreshIndexState()
    }
  }

  private range(start: number, end: number) {
    return Array(end - start).fill(0).map((_, i: number) => i + start)
  }

  protected async runOrDeferEffect(
    effect: Effect,
    payload: any,
    nextBlock: NextBlock,
    context: any,
  ) {
    const { block, lastIrreversibleBlockNumber } = nextBlock
    const { blockInfo } = block
    const queueTime = Date.now()
    const curriedEffectRun = this.curryEffectRun(effect, payload, blockInfo, context, queueTime)
    const shouldRunImmediately = (
      !effect.deferUntilIrreversible || blockInfo.blockNumber <= lastIrreversibleBlockNumber
    )
    if (shouldRunImmediately) {
      this.runningEffects.push(
        makeQuerablePromise(curriedEffectRun(blockInfo.blockNumber, true), false),
      )
    } else {
      if (!this.deferredEffects[blockInfo.blockNumber]) {
        this.deferredEffects[blockInfo.blockNumber] = []
      }
      this.log.debug(
        `Deferring effect for '${effect.actionType}' until block ${blockInfo.blockNumber} becomes irreversible`
      )
      this.deferredEffects[blockInfo.blockNumber].push(curriedEffectRun)
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

  private curryEffectRun(
    effect: Effect,
    payload: any,
    blockInfo: BlockInfo,
    context: any,
    queueTime: number,
  ): CurriedEffectRun {
    return async (currentBlockNumber: number, immediate: boolean = false) => {
      const effectStart = Date.now()
      const waitedBlocks = currentBlockNumber - blockInfo.blockNumber
      const waitedTime = effectStart - queueTime
      this.log.debug(
        `Running ${immediate ? '' : 'deferred '}effect for '${effect.actionType}'...` +
        (immediate ? '' : ` (waited ${waitedBlocks} blocks; ${waitedTime}ms)`)
      )
      await effect.run(payload, blockInfo, context)
      const effectTime = Date.now() - effectStart
      this.log.debug(`Ran ${immediate ? '' : 'deferred '}effect for '${effect.actionType}' (${effectTime}ms)`)
    }
  }

  private async runDeferredEffects(lastIrreversibleBlockNumber: number) {
    const nextDeferredBlockNumber = this.getNextDeferredBlockNumber()
    if (!nextDeferredBlockNumber) { return }
    for (const blockNumber of this.range(nextDeferredBlockNumber, lastIrreversibleBlockNumber + 1)) {
      if (this.deferredEffects[blockNumber]) {
        const effects = this.deferredEffects[blockNumber]
        this.log.debug(`Block ${blockNumber} is now irreversible, running ${effects.length} deferred effects`)
        for (const deferredEffectRun of effects) {
          this.runningEffects.push(
            makeQuerablePromise(deferredEffectRun(blockNumber), false)
          )
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

  private checkRunningEffects(): EffectsInfo {
    const newEffectErrors = this.runningEffects
      .filter((effectPromise) => {
        return effectPromise.isRejected()
      })
      .map((rejectedPromise): string => {
        const error = rejectedPromise.error()
        if (error && error.stack) {
          return error.stack
        }
        return '(stack trace not captured)'
      })
    this.effectErrors.push(...newEffectErrors)
    this.effectErrors.splice(0, this.effectErrors.length - this.maxEffectErrors)
    this.runningEffects = this.runningEffects.filter((effectPromise) => effectPromise.isPending())
    return {
      numberOfRunningEffects: this.runningEffects.length,
      effectErrors: this.effectErrors,
    }
  }

  private rollbackDeferredEffects(rollbackTo: number) {
    const blockNumbers = Object.keys(this.deferredEffects).map((num) => parseInt(num, 10))
    const toRollBack = blockNumbers.filter((bn) => bn >= rollbackTo)
    for (const blockNumber of toRollBack) {
      this.log.debug(
        `Removing ${this.deferredEffects[blockNumber].length} deferred effects for rolled back block ${blockNumber}`
      )
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

  private async loggedUpdateIndexState(
    state: any,
    nextBlock: NextBlock,
    isReplay: boolean,
    handlerVersionName: string,
    context?: any,
  ): Promise<void> {
    this.log.debug('Updating Index State...')
    const updateStart = Date.now()
    await this.updateIndexState(state, nextBlock, isReplay, handlerVersionName, context)
    const updateTime = Date.now() - updateStart
    this.log.debug(`Updated Index State (${updateTime}ms)`)
  }

  private async refreshIndexState() {
    this.log.debug('Loading Index State...')
    const refreshStart = Date.now()
    const { blockNumber, blockHash, handlerVersionName } = await this.loadIndexState()
    this.lastProcessedBlockNumber = blockNumber
    this.lastProcessedBlockHash = blockHash
    this.handlerVersionName = handlerVersionName
    const refreshTime = Date.now() - refreshStart
    this.log.debug(`Loaded Index State (${refreshTime}ms)`)
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
