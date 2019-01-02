import * as Logger from "bunyan"
import { Block, BlockMeta, DeferredEffects, HandlerVersion, IndexState, VersionedAction } from "./interfaces"

/**
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through the
 * `Updater`s and `Effect`s of the current `HandlerVersion`. Pass an object exposing a persistence API as `state` to the
 * `handleWithState` method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`. Implement `rollbackTo` to handle when a fork is encountered.
 *
 */
export abstract class AbstractActionHandler {
  protected lastProcessedBlockNumber: number = 0
  protected lastProcessedBlockHash: string = ""
  protected handlerVersionName: string = "v1"
  protected log: Logger
  private deferredEffects: DeferredEffects = {}
  private handlerVersionMap: { [key: string]: HandlerVersion } = {}

  /**
   * @param handlerVersions  An array of `HandlerVersion`s that are to be used when processing blocks. The default
   *                         version name is `"v1"`.
   */
  constructor(
    handlerVersions: HandlerVersion[],
  ) {
    this.initHandlerVersions(handlerVersions)
    this.log = Logger.createLogger({ name: "demux" })
  }

  /**
   * Receive block, validate, and handle actions with updaters and effects
   */
  public async handleBlock(
    block: Block,
    blockMeta: BlockMeta,
    isReplay: boolean,
  ): Promise<number | null> {
    const { blockInfo } = block

    const { isRollback, isFirstBlock } = blockMeta

    if (isRollback || (isReplay && isFirstBlock)) {
      const rollbackBlockNumber = blockInfo.blockNumber - 1
      const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber
      this.log.info(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`)
      await this.rollbackTo(rollbackBlockNumber)
      await this.refreshIndexState()
    } else if (this.lastProcessedBlockNumber === 0 && this.lastProcessedBlockHash === "") {
      await this.refreshIndexState()
    }

    const nextBlockNeeded = this.lastProcessedBlockNumber + 1

    // Just processed this block; skip
    if (blockInfo.blockNumber === this.lastProcessedBlockNumber
        && blockInfo.blockHash === this.lastProcessedBlockHash) {
      return null
    }

    // If it's the first block but we've already processed blocks, seek to next block
    if (isFirstBlock && this.lastProcessedBlockHash) {
      return nextBlockNeeded
    }
    // Only check if this is the block we need if it's not the first block
    if (!isFirstBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return nextBlockNeeded
      }
      // Block sequence consistency should be handled by the ActionReader instance
      if (blockInfo.previousBlockHash !== this.lastProcessedBlockHash) {
        throw Error("Block hashes do not match; block not part of current chain.")
      }
    }

    const handleWithArgs: (state: any, context?: any) => Promise<void> = async (state: any, context: any = {}) => {
      await this.handleActions(state, block, context, isReplay)
    }
    await this.handleWithState(handleWithArgs)
    return null
  }

  /**
   * Updates the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state, coinciding with the block
   * that has just been processed. These are the same values read by `updateIndexState()`.
   */
  protected abstract async updateIndexState(
    state: any,
    block: Block,
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
   * This method is used when matching the types of incoming actions against the types the `Updater`s and `Effect`s are
   * subscribed to. When this returns true, their corresponding functions will run.
   *
   * By default, this method tests for direct equivalence between the incoming candidate type and the type that is
   * subscribed. Override this method to extend this functionality (e.g. wildcards).
   *
   * @param candidateType   The incoming action's type
   * @param subscribedType  The type the Updater of Effect is subscribed to
   */
  protected matchActionType(candidateType: string, subscribedType: string): boolean {
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
    block: Block,
    isReplay: boolean,
    context: any,
  ): Promise<VersionedAction[]> {
    const versionedActions = [] as VersionedAction[]
    const { actions, blockInfo } = block
    for (const action of actions) {
      let updaterIndex = -1
      for (const updater of this.handlerVersionMap[this.handlerVersionName].updaters) {
        updaterIndex += 1
        if (this.matchActionType(action.type, updater.actionType)) {
          const { payload } = action
          const newVersion = await updater.apply(state, payload, blockInfo, context)
          if (newVersion && !this.handlerVersionMap.hasOwnProperty(newVersion)) {
            this.warnHandlerVersionNonexistent(newVersion)
          } else if (newVersion) {
            this.log.info(`BLOCK ${blockInfo.blockNumber}: Updating Handler Version to '${newVersion}'`)
            this.warnSkippingUpdaters(updaterIndex, action.type)
            await this.updateIndexState(state, block, isReplay, newVersion, context)
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
    block: Block,
    context: any,
  ) {
    for (const { action, handlerVersionName } of versionedActions) {
      for (const effect of this.handlerVersionMap[handlerVersionName].effects) {
        if (this.matchActionType(action.type, effect.actionType)) {
          const { payload } = action
          if (!effect.deferUntilIrreversible || block.blockInfo.isIrreversible) {
            effect.run(payload, block, context)
          } else if (!this.deferredEffects[block.blockInfo.blockNumber]) {
            this.deferredEffects[block.blockInfo.blockNumber] = [
              () => effect.run(payload, block, context),
            ]
          } else {
            this.deferredEffects[block.blockInfo].push(
              () => effect.run(payload, block, context),
            )
          }

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
    block: Block,
    context: any,
    isReplay: boolean,
  ): Promise<void> {
    const { blockInfo } = block

    const versionedActions = await this.applyUpdaters(state, block, isReplay, context)
    if (!isReplay) {
      this.runEffects(versionedActions, block, context)
    }

    await this.updateIndexState(state, block, isReplay, this.handlerVersionName, context)
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
  }

  private runDeferredEffects(lastIrreversibleBlockNumber) {
    for (const deferredEffect of deferredEffects) {

    }
  }

  private initHandlerVersions(handlerVersions: HandlerVersion[]) {
    if (handlerVersions.length === 0) {
      throw new Error("Must have at least one handler version.")
    }
    for (const handlerVersion of handlerVersions) {
      if (this.handlerVersionMap.hasOwnProperty(handlerVersion.versionName)) {
        throw new Error(`Handler version name '${handlerVersion.versionName}' already exists. ` +
                        "Handler versions must have unique names.")
      }
      this.handlerVersionMap[handlerVersion.versionName] = handlerVersion
    }
    if (!this.handlerVersionMap.hasOwnProperty(this.handlerVersionName)) {
      this.handlerVersionName = handlerVersions[0].versionName
      this.warnMissingHandlerVersion(handlerVersions[0].versionName)
    } else if (handlerVersions[0].versionName !== "v1") {
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
