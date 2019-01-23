import { ImproperStartAtBlockError } from "./errors"
import { Block } from "./interfaces"
import blockchains from "./testHelpers/blockchains"
import { TestActionReader } from "./testHelpers/TestActionReader"

describe("Action Reader", () => {
  let actionReader: TestActionReader
  let actionReaderStartAt3: TestActionReader
  let actionReaderNegative: TestActionReader
  let blockchain: Block []
  let forked: Block []

  beforeEach(() => {
    actionReader = new TestActionReader()
    actionReaderStartAt3 = new TestActionReader({ startAtBlock: 3 })
    actionReaderNegative = new TestActionReader({ startAtBlock: -1 })

    blockchain = JSON.parse(JSON.stringify(blockchains.blockchain))
    forked = JSON.parse(JSON.stringify(blockchains.forked))

    actionReader.blockchain = blockchain
    actionReaderStartAt3.blockchain = blockchain
    actionReaderNegative.blockchain = blockchain
  })

  it("gets the head block number", async () => {
    const headBlockNumber = await actionReader.getHeadBlockNumber()
    expect(headBlockNumber).toBe(4)
  })

  it("gets the next block", async () => {
    const { block } = await actionReader.getNextBlock()
    expect(block.blockInfo.blockNumber).toBe(1)
  })

  it("gets the next block when starting ahead", async () => {
    const { block } = await actionReaderStartAt3.getNextBlock()
    expect(block.blockInfo.blockNumber).toBe(3)
  })

  it("gets the next block when negative indexing", async () => {
    const { block } = await actionReaderNegative.getNextBlock()
    expect(block.blockInfo.blockNumber).toBe(3)
  })

  it("seeks to the first block", async () => {
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.seekToBlock(1)
    const { block, blockMeta} = await actionReader.getNextBlock()
    expect(block.blockInfo.blockNumber).toBe(1)
    expect(blockMeta.isEarliestBlock).toBe(true)
  })

  it("seeks to non-first block", async () => {
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.seekToBlock(2)
    const { block } = await actionReader.getNextBlock()
    expect(block.blockInfo.blockNumber).toBe(2)
  })

  it("does not seek to block earlier than startAtBlock", async () => {
    await actionReaderStartAt3.getNextBlock()
    const result = actionReaderStartAt3.seekToBlock(2)
    expect(result).rejects.toThrow(ImproperStartAtBlockError)
  })

  it("handles rollback correctly", async () => {
    actionReader._testLastIrreversible = 1
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()

    actionReader.blockchain = forked
    const { block, blockMeta } = await actionReader.getNextBlock()
    expect(blockMeta.isRollback).toBe(true)
    expect(block.blockInfo.blockHash).toBe("foo")

    const { block: block2, blockMeta: blockMeta2 } = await actionReader.getNextBlock()
    expect(blockMeta2.isRollback).toBe(false)
    expect(block2.blockInfo.blockHash).toBe("wrench")

    const { block: block3, blockMeta: blockMeta3 } = await actionReader.getNextBlock()
    expect(blockMeta3.isRollback).toBe(false)
    expect(block3.blockInfo.blockHash).toBe("madeit")
  })

  it("indicates when the same block is returned", async () => {
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    const { blockMeta } = (await actionReader.getNextBlock())
    expect(blockMeta.isNewBlock).toBe(false)
  })

  it("prunes history to last irreversible block", async () => {
    actionReader._testLastIrreversible = 1
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    await actionReader.getNextBlock()
    expect(actionReader._lastIrreversibleBlockNumber).toEqual(1)
    expect(actionReader._blockHistory[0].blockInfo.blockNumber).toEqual(actionReader._lastIrreversibleBlockNumber)

    actionReader._testLastIrreversible = 3
    await actionReader.getNextBlock()
    expect(actionReader._lastIrreversibleBlockNumber).toEqual(3)
    expect(actionReader._blockHistory[0].blockInfo.blockNumber).toEqual(actionReader._lastIrreversibleBlockNumber)
  })
})
