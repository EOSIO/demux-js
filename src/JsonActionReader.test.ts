import { JsonActionReader } from './JsonActionReader'
import blockchains from './testHelpers/blockchains'
import { JsonBlockDoesNotExist, JsonBlockIndicatesWrongPosition } from './errors'

describe('Action Reader', () => {
  let actionReader: JsonActionReader
  let invalidActionReader: JsonActionReader

  beforeEach(() => {
    actionReader = new JsonActionReader({ blockchain: blockchains.blockchain })
    invalidActionReader = new JsonActionReader({ blockchain: blockchains.upgradeHandler })
  })

  it('gets the head block number', async () => {
    const headBlockNumber = await actionReader.getHeadBlockNumber()
    expect(headBlockNumber).toBe(4)
  })

  it('gets the last irreversible block number', async () => {
    const libNumber = await actionReader.getLastIrreversibleBlockNumber()
    expect(libNumber).toBe(4)
  })

  it('gets block', async () => {
    const block = await actionReader.getBlock(1)
    expect(block.blockInfo.blockNumber).toBe(1)
  })

  it('throws due to bad block number at head', async () => {
    const headBlockNumberPromise = invalidActionReader.getHeadBlockNumber()
    await expect(headBlockNumberPromise).rejects.toThrow(JsonBlockIndicatesWrongPosition)
  })

  it('throws because block number does not match its position', async () => {
    const blockPromise = invalidActionReader.getBlock(1)
    await expect(blockPromise).rejects.toThrow(JsonBlockIndicatesWrongPosition)
  })

  it('throws because block does not exist', async () => {
    const blockPromise = invalidActionReader.getBlock(4)
    await expect(blockPromise).rejects.toThrow(JsonBlockDoesNotExist)
  })
})
