import { EosAction } from "./interfaces"
import { Block } from "../../../../index"

export class MongoBlock implements Block {
  public actions: EosAction[]
  public blockHash: string
  public blockNumber: number
  public previousBlockHash: string
  constructor(rawBlock: any, blockState: any) {
    this.actions = this.collectActionsFromBlock(rawBlock)
    this.blockNumber = blockState.block_num
    this.blockHash = blockState.block_id
    this.previousBlockHash = blockState.block_header_state.header.previous
  }

  protected collectActionsFromBlock(rawBlock: any = { actions: [] }): EosAction[] {
    return this.flattenArray(rawBlock.map((trx: any) => {
      return trx.actions.map((action: any, actionIndex: number) => {

        // Delete unneeded hex data if we have deserialized data
        if (action.payload) {
          delete action.payload.hex_data // eslint-disable-line
        }

        console.info({
          type: action.type,
          payload: {
            transactionId: rawBlock.trx_id,
            actionIndex,
            ...action.payload,
          },
        })

        return {
          type: action.type,
          payload: {
            transactionId: rawBlock.trx_id,
            actionIndex,
            ...action.payload,
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
