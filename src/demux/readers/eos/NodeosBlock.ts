import { EosAction } from "./interfaces"
import {Block, Transaction} from "../../../../index"

export class NodeosBlock implements Block {
  public actions: EosAction[]
  public transactions: Transaction[]
  public blockHash: string
  public blockNumber: number
  public previousBlockHash: string
  constructor(rawBlock: any) {
    this.transactions = []
    this.actions = []
    this.blockNumber = rawBlock.block_num
    this.blockHash = rawBlock.id
    this.previousBlockHash = rawBlock.previous
    this.collectActionsAndTransactionsFromBlock(rawBlock)
  }

  protected collectActionsAndTransactionsFromBlock(rawBlock: any) {
    rawBlock.transactions.forEach((transaction: any) => {
      if (!transaction.trx.transaction) {
        return // Deferred transaction, cannot decode
      }
      const actions = transaction.trx.transaction.actions.map((action: any, actionIndex: number) => {
        // Delete unneeded hex data if we have deserialized data
        if (action.data) {
          delete action.hex_data // eslint-disable-line
        }
        const formattedAction = {
          type: `${action.account}::${action.name}`,
          payload: {
            transactionId: transaction.trx.id,
            actionIndex,
            ...action,
          },
        }
        this.actions.push(formattedAction)
        return formattedAction
      })
      // Delete unneeded data
      delete transaction.trx.signatures
      delete transaction.trx.packed_trx
      // reattach same actions to transaction
      transaction.trx.transaction.actions = actions
      transaction.block_producer = rawBlock.producer
      transaction.block_id = rawBlock.id
      transaction.block_num = rawBlock.block_num
      transaction.block_timestamp = rawBlock.timestamp
      this.transactions.push(transaction)
    })
  }
}
