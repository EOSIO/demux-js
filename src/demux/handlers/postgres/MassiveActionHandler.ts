import AbstractActionHandler from "../AbstractActionHandler"
import { Effect, Updater } from "../../../../index"

export default class MassiveActionHandler extends AbstractActionHandler {
  constructor(
    protected updaters: Updater[],
    protected effects: Effect[],
    protected massiveInstance: any,
  ) {
    super(updaters, effects)
  }

  public async handleWithState(handle: (state: any) => void) {
    await new Promise((resolve, reject) => {
      this.massiveInstance.withTransaction(async (tx: any) => {
        try {
          await handle(tx)
          resolve(tx)
        } catch (err) {
          reject()
        }
      }, {
        mode: new this.massiveInstance.pgp.txMode.TransactionMode({
          tiLevel: this.massiveInstance.pgp.txMode.isolationLevel.serializable,
        }),
      })
    })
  }

  protected async rollbackTo(blockNumber: number) {
    throw Error(`Cannot roll back to ${blockNumber}; \`rollbackTo\` not implemented.`)
  }
}
