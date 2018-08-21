import { AbstractActionReader } from "./AbstractActionReader"
import { Block } from "./interfaces"

class TestActionReader extends AbstractActionReader {
  public blockchain: Block[] = []

  public getBlockHistory(): Block[] {
    return this.blockHistory
  }

  public async getHeadBlockNumber(): Promise<number> {
    return this.blockchain[this.blockchain.length - 1].blockInfo.blockNumber
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    return this.blockchain[blockNumber - 1]
  }
}

describe("Action Reader", () => {
  let actionReader: TestActionReader
  let actionReaderStartAt3: TestActionReader
  let actionReaderNegative: TestActionReader
  let blockchain: Block []
  let forked: Block []

  beforeEach(() => {
    actionReader = new TestActionReader()
    actionReaderStartAt3 = new TestActionReader(3)
    actionReaderNegative = new TestActionReader(-1)

    blockchain = [
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000000",
          blockNumber: 1,
          previousBlockHash: "",
          timestamp: new Date("2018-06-06T11:53:37.000"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000001",
          blockNumber: 2,
          previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
          timestamp: new Date("2018-06-06T11:53:37.500"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000002",
          blockNumber: 3,
          previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000001",
          timestamp: new Date("2018-06-06T11:53:38.000"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000003",
          blockNumber: 4,
          previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000002",
          timestamp: new Date("2018-06-06T11:53:38.500"),
        },
      },
    ]

    forked = [
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000000",
          blockNumber: 1,
          previousBlockHash: "",
          timestamp: new Date("2018-06-06T11:53:37.000"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "0000000000000000000000000000000000000000000000000000000000000001",
          blockNumber: 2,
          previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
          timestamp: new Date("2018-06-06T11:53:37.500"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "foo",
          blockNumber: 3,
          previousBlockHash: "0000000000000000000000000000000000000000000000000000000000000001",
          timestamp: new Date("2018-06-06T11:53:38.000"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "wrench",
          blockNumber: 4,
          previousBlockHash: "foo",
          timestamp: new Date("2018-06-06T11:53:38.500"),
        },
      },
      {
        actions: [],
        blockInfo: {
          blockHash: "madeit",
          blockNumber: 5,
          previousBlockHash: "wrench",
          timestamp: new Date("2018-06-06T11:53:39.000"),
        },
      },
    ]

    actionReader.blockchain = blockchain
    actionReaderStartAt3.blockchain = blockchain
    actionReaderNegative.blockchain = blockchain
  })

  it("gets the head block number", async () => {
    const headBlockNumber = await actionReader.getHeadBlockNumber()
    expect(headBlockNumber).toBe(4)
  })

  it("gets the next block", async () => {
    const [block] = await actionReader.nextBlock()
    expect(block.blockInfo.blockNumber).toBe(1)
  })

  it("gets the next block when starting ahead", async () => {
    const [block] = await actionReaderStartAt3.nextBlock()
    expect(block.blockInfo.blockNumber).toBe(3)
  })

  it("gets the next block when negative indexing", async () => {
    const [block] = await actionReaderNegative.nextBlock()
    expect(block.blockInfo.blockNumber).toBe(3)
  })

  it("seeks to the first block", async () => {
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.seekToBlock(1)
    const [block] = await actionReader.nextBlock()
    expect(block.blockInfo.blockNumber).toBe(1)
    expect(actionReader.isFirstBlock).toBe(true)
  })

  it("seeks to non-first block", async () => {
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.seekToBlock(2)
    const [block] = await actionReader.nextBlock()
    expect(block.blockInfo.blockNumber).toBe(2)
  })

  it("does not seek to block earlier than startAtBlock", async () => {
    await actionReaderStartAt3.nextBlock()
    const expectedError = new Error("Cannot seek to block before configured startAtBlock.")
    await expect(actionReaderStartAt3.seekToBlock(2)).rejects.toEqual(expectedError)
  })

  it("handles rollback correctly", async () => {
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    await actionReader.nextBlock()
    actionReader.blockchain = forked
    const [block, isRollback] = await actionReader.nextBlock()
    expect(isRollback).toBe(true)
    expect(block.blockInfo.blockHash).toBe("foo")
    const [block2, isRollback2] = await actionReader.nextBlock()
    expect(isRollback2).toBe(false)
    expect(block2.blockInfo.blockHash).toBe("wrench")
    const [block3, isRollback3] = await actionReader.nextBlock()
    expect(isRollback3).toBe(false)
    expect(block3.blockInfo.blockHash).toBe("madeit")
  })
})
