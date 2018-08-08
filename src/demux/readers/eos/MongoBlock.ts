import { EosAction } from "./interfaces"
import { Block } from "../../../../index"

export class MongoBlock implements Block {
  public actions: EosAction[]
  public blockHash: string
  public blockNumber: number
  public previousBlockHash: string
  constructor(rawBlock: any) {
    this.actions = this.collectActionsFromBlock(rawBlock)
    this.blockNumber = rawBlock.block_num
    this.blockHash = rawBlock.block_id
    this.previousBlockHash = rawBlock.block.previous
  }

  protected collectActionsFromBlock(rawBlock: any = { actions: [] }): EosAction[] {
    return this.flattenArray(rawBlock.block.transactions.map(({ trx }: any) => {
      return trx.transaction.actions.map((action: any, actionIndex: number) => {

        // Delete unneeded hex data if we have deserialized data
        if (action.payload) {
          delete action.hex_data // eslint-disable-line
        }

        return {
          type: `${action.account}::${action.name}`,
          payload: {
            transactionId: trx.trx.id,
            actionIndex,
            ...action,
          },
        }
      })
    }))
  }

  private flattenArray(arr: any[]): any[] {
    return arr.reduce((flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? this.flattenArray(toFlatten) : toFlatten), [])
  }
}
