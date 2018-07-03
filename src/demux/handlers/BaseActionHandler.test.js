const BaseActionHandler = require("./BaseActionHandler")
const blockData = require("./test-data/baseactionhandler-rawblock")

describe("BaseActionHandler", () => {
  let actionHandler
  let actions

  const notRunUpdater = jest.fn()
  const notRunEffect = jest.fn()

  const runUpdater = jest.fn()
  const runEffect = jest.fn()

  beforeAll(() => {
    actionHandler = new BaseActionHandler({
      updaters: [
        {
          actionType: "eosio.token::transfer",
          updater: runUpdater,
        },
        {
          actionType: "eosio.token::issue",
          updater: notRunUpdater,
        },
      ],
      effects: [
        {
          actionType: "eosio.token::transfer",
          effect: runEffect,
        },
        {
          actionType: "eosio.token::issue",
          effect: notRunEffect,
        },
      ],
    })

    actions = [
      {
        payload: {},
        type: "eosio.token::transfer",
      },
      {
        payload: {},
        type: "eosio.system::regproducer",
      },
    ]
  })


  it("runs the correct updater based on action type", () => {
    actionHandler.runUpdaters({ state: {}, actions, blockInfo: {}, context: {} })
    expect(runUpdater).toHaveBeenCalled()
    expect(notRunUpdater).not.toHaveBeenCalled()
  })

  it("runs the correct effect based on action type", () => {
    actionHandler.runEffects({ state: {}, actions, blockInfo: {}, context: {} })
    expect(runEffect).toHaveBeenCalled()
    expect(notRunEffect).not.toHaveBeenCalled()
  })

  it("seeks to the next block needed when on first block and other blocks have been processed", async () => {
    actionHandler._lastProcessedBlockHash = "abcd"
    const firstBlock = true
    const { nextBlockNeeded } = await actionHandler.handleBlock({ state: {}, blockData, rollback: false, firstBlock })
    expect(nextBlockNeeded).toBe(1)
    actionHandler._lastProcessedBlockHash = null
  })

  it("seeks to the next block needed when block number doesn't match last processed block", async () => {
    actionHandler._lastProcessedBlockNumber = 18
    const firstBlock = false
    const { nextBlockNeeded } = await actionHandler.handleBlock({ state: {}, blockData, rollback: false, firstBlock })
    expect(nextBlockNeeded).toBe(19)
    actionHandler._lastProcessedBlockNumber = 0
  })

  it("throws error if previous block hash and last processed don't match up", async () => {
    actionHandler._lastProcessedBlockNumber = 19
    actionHandler._lastProcessedBlockHash = "asdfasdfasdf"

    const params = { state: {}, blockData, rollback: false, firstBlock: false }
    const expectedError = new Error("Block hashes do not match; block not part of current chain.")
    expect(actionHandler.handleBlock(params)).rejects.toEqual(expectedError)

    actionHandler._lastProcessedBlockHash = null
    actionHandler._lastProcessedBlockNumber = 0
  })
})
