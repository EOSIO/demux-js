import { Action, Block, BlockInfo, HandlerVersion, IndexState, } from "./interfaces"

/**
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through
 * `Updater`s and `Effect`s. Pass an object exposing a persistence API as `state` in the `handleWithState`
 * method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`.
 */
export abstract class AbstractActionHandler {
  private lastProcessedBlockNumber: number = 0
  private lastProcessedBlockHash: string = ""
  private handlerVersionName: string = "v1"
  private handlerVersionMap: { [key: string]: HandlerVersion } = {}

  constructor(
    handlerVersions: HandlerVersion[],
  ) {
    this.initHandlerVersions(handlerVersions)
  }

  /**
   * Receive block, validate, and handle actions with updaters and effects
   */
  public async handleBlock(
    block: Block,
    isRollback: boolean,
    isFirstBlock: boolean,
    isReplay: boolean = false,
  ): Promise<[boolean, number]> {
    const { blockInfo } = block

    if (isRollback || (isReplay && isFirstBlock)) {
      const rollbackBlockNumber = blockInfo.blockNumber - 1
      const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber
      console.info(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`)
      await this.rollbackTo(rollbackBlockNumber)
      await this.refreshIndexState()
      await this.refreshHandlerVersionState()
    } else if (this.lastProcessedBlockNumber === 0 && this.lastProcessedBlockHash === "") {
      await this.refreshIndexState()
      await this.refreshHandlerVersionState()
    }

    const nextBlockNeeded = this.lastProcessedBlockNumber + 1

    // Just processed this block; skip
    if (blockInfo.blockNumber === this.lastProcessedBlockNumber
        && blockInfo.blockHash === this.lastProcessedBlockHash) {
      return [false, 0]
    }

    // If it's the first block but we've already processed blocks, seek to next block
    if (isFirstBlock && this.lastProcessedBlockHash) {
      return [true, nextBlockNeeded]
    }
    // Only check if this is the block we need if it's not the first block
    if (!isFirstBlock) {
      if (blockInfo.blockNumber !== nextBlockNeeded) {
        return [true, nextBlockNeeded]
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
    return [false, 0]
  }

  /**
   * Updates the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state, coinciding with the block
   * that has just been processed. These are the same values read by `updateIndexState()`.
   */
  protected abstract async updateIndexState(state: any, block: Block, isReplay: boolean, context?: any): Promise<void>

  /**
   * Returns a promise for the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state,
   * coinciding with the block that has just been processed.
   * These are the same values written by `updateIndexState()`.
   * @returns A promise that resolves to an `IndexState`
   */
  protected abstract async loadIndexState(): Promise<IndexState>

  protected abstract async updateHandlerVersionState(handlerVersionName: string): Promise<void>

  protected abstract async loadHandlerVersionState(): Promise<string>

  /**
   * Calls handleActions with the appropriate state passed by calling the `handle` parameter function.
   * Optionally, pass in a `context` object as a second parameter.
   */
  protected abstract async handleWithState(handle: (state: any, context?: any) => void): Promise<void>

  /**
   * Process actions against deterministically accumulating updater functions.
   */
  protected async applyUpdaters(
    state: any,
    block: Block,
    context: any,
  ): Promise<Array<[Action, string]>> {
    const versionedActions = [] as Array<[Action, string]>
    const { actions, blockInfo } = block
    for (const action of actions) {
      let updaterIndex = -1
      for (const updater of this.handlerVersionMap[this.handlerVersionName].updaters) {
        updaterIndex += 1
        if (action.type === updater.actionType) {
          const { payload } = action
          const newVersion = await updater.apply(state, payload, blockInfo, context)
          versionedActions.push([action, this.handlerVersionName])
          if (newVersion) {
            if (!this.handlerVersionMap.hasOwnProperty(newVersion)) {
              console.warn(`Attempted to switch to handler version '${newVersion}', however this version ` +
                           `does not exist. Handler will continue as version '${this.handlerVersionName}'`)
              continue
            }
            console.info(`BLOCK ${blockInfo.blockNumber}: Updating Handler Version to '${newVersion}'`)
            await this.updateHandlerVersionState(newVersion)
            this.handlerVersionName = newVersion
            const remainingUpdaters = updaterIndex - this.handlerVersionMap[this.handlerVersionName].updaters.length - 1
            if (remainingUpdaters) {
              console.warn(`Handler Version was updated to version '${this.handlerVersionName}' while there ` +
                           `were still ${remainingUpdaters} updaters left! These updaters will be skipped.`)
            }
            break
          }
        }
      }
    }
    return versionedActions
  }

  /**
   * Process actions against asynchronous side effects.
   */
  protected runEffects(
    versionedActions: Array<[Action, string]>,
    blockInfo: BlockInfo,
    context: any,
  ): void {
    for (const [action, handlerVersionName] of versionedActions) {
      for (const effect of this.handlerVersionMap[handlerVersionName].effects) {
        if (action.type === effect.actionType) {
          const { payload } = action
          effect.run(payload, blockInfo, context)
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

    const versionedActions = await this.applyUpdaters(state, block, context)
    if (!isReplay) {
      this.runEffects(versionedActions, blockInfo, context)
    }

    await this.updateIndexState(state, block, isReplay, context)
    this.lastProcessedBlockNumber = blockInfo.blockNumber
    this.lastProcessedBlockHash = blockInfo.blockHash
  }

  private initHandlerVersions(handlerVersions: HandlerVersion[]) {
    if (handlerVersions.length === 0) {
      throw new Error("Must have at least one handler version.")
    }
    for (const handlerVersion of handlerVersions) {
      if (this.handlerVersionMap.hasOwnProperty(handlerVersion.name)) {
        throw new Error(`Handler version name '${handlerVersion.name}' already exists. ` +
                        "Handler versions must have unique names.")
      }
      this.handlerVersionMap[handlerVersion.name] = handlerVersion
    }
    if (!this.handlerVersionMap.hasOwnProperty(this.handlerVersionName)) {
      console.warn(`No Handler Version found with name '${this.handlerVersionName}': starting with ` +
                   `'${handlerVersions[0].name}' instead.`)
      this.handlerVersionName = handlerVersions[0].name
    } else if (handlerVersions[0].name !== "v1") {
      console.warn(`First Handler Version '${handlerVersions[0].name}' is not '${this.handlerVersionName}', ` +
                   `and there is also '${this.handlerVersionName}' present. Handler Version ` +
                   `'${this.handlerVersionName}' will be used, even though it is not first.`)
    }
  }

  private async refreshIndexState() {
    const { blockNumber, blockHash } = await this.loadIndexState()
    this.lastProcessedBlockNumber = blockNumber
    this.lastProcessedBlockHash = blockHash
  }

  private async refreshHandlerVersionState() {
    this.handlerVersionName = await this.loadHandlerVersionState()
  }
}
