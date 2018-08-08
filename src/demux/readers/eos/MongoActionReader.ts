import { AbstractActionReader } from "../AbstractActionReader"
import { MongoBlock } from "./MongoBlock"

import { MongoClient } from "mongodb"

/**
 * Implementation of an ActionReader that polls a mongodb.
 */
export class MongoActionReader extends AbstractActionReader {
  protected mongoEndpoint: string
  protected mongodb: any
  constructor(
    mongoEndpoint: string = "mongodb://127.0.0.1:27017",
    public startAtBlock: number = 1,
    protected onlyIrreversible: boolean = false,
    protected maxHistoryLength: number = 600,
  ) {
    super(startAtBlock, onlyIrreversible, maxHistoryLength)
    this.mongoEndpoint = mongoEndpoint
    this.mongodb = null
  }

  public async initialize() {
    const mongoInstance = await MongoClient.connect(this.mongoEndpoint, { useNewUrlParser: true })
    this.mongodb = await mongoInstance.db("EOS")
  }

  public async getHeadBlockNumber(): Promise<number> {
    const [blockInfo] = await this.mongodb.collection("block_states")
      .find({})
      .limit(1)
      .sort({ $natural: -1 })
      .toArray()

    if (this.onlyIrreversible) {
      return blockInfo.block_header_state.dpos_irreversible_blocknum
    }

    return blockInfo.block_header_state.block_num
  }

  public async getBlock(blockNumber: number): Promise<MongoBlock> {
    // Will not handle scenario of a fork since it only grabs first block
    const [rawBlock] = await this.mongodb.collection("blocks")
      .find({ "block_num": blockNumber })
      .toArray()

    const block = new MongoBlock(rawBlock)
    return block
  }
}
