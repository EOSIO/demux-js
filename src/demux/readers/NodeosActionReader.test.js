describe("NodeosActionReader", () => {
  let getSpy
  let postSpy
  let mockRequest

  const blockInfo = {
    last_irreversible_block_num: 10,
    head_block_num: 20,
  }

  beforeAll(() => {
    mockRequest = {
      get: () => new Promise((resolve) => {
        resolve(blockInfo)
      }),
      post: () => new Promise((resolve) => {
        resolve(require("./test-data/nodeosactionreader-rawblock")) // eslint-disable-line
      }),
    }

    getSpy = jest.spyOn(mockRequest, "get")
    postSpy = jest.spyOn(mockRequest, "post")
    jest.mock("request-promise-native", () => mockRequest)
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  it("returns last irreversible block if configured", async () => {
    const NodeosActionReader = require("./NodeosActionReader") // eslint-disable-line
    const reader = new NodeosActionReader({ onlyIrreversible: true })
    const blockNum = await reader.getHeadBlockNumber()
    expect(getSpy).toBeCalled()
    expect(blockNum).toBe(10)
  })

  it("returns head block if configured", async () => {
    const NodeosActionReader = require("./NodeosActionReader") // eslint-disable-line
    const reader = new NodeosActionReader({ onlyIrreversible: false })
    const blockNum = await reader.getHeadBlockNumber()
    expect(getSpy).toBeCalled()
    expect(blockNum).toBe(20)
  })

  it("flattens arrays", async () => {
    const NodeosActionReader = require("./NodeosActionReader") // eslint-disable-line
    const reader = new NodeosActionReader({ onlyIrreversible: false })
    const array = [[1, [2, 3]], [4, 5, 6]]
    const flattenedArray = await reader.flattenArray(array)
    expect(flattenedArray).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("collects actions from blocks", async () => {
    const NodeosActionReader = require("./NodeosActionReader") // eslint-disable-line
    const reader = new NodeosActionReader({ onlyIrreversible: false })
    const rawBlock = require("./test-data/nodeosactionreader-rawblock") //eslint-disable-line
    const actions = reader.collectActionsFromBlock(rawBlock)
    expect(actions).toEqual([
      {
        payload: {
          account: "testing",
          actionIndex: 0,
          authorization: [
            {
              actor: "testing",
              permission: "active",
            },
          ],
          data: {
            memo: "EOS is awesome!",
          },
          name: "action",
          transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
        },
        type: "testing::action",
      },
      {
        payload: {
          account: "testing",
          actionIndex: 1,
          authorization: [
            {
              actor: "testing",
              permission: "active",
            },
          ],
          data: {
            memo: "Go EOS!",
          },
          name: "action2",
          transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
        },
        type: "testing::action2",
      },
    ])
  })

  it("gets a block", async () => {
    const NodeosActionReader = require("./NodeosActionReader") // eslint-disable-line
    const reader = new NodeosActionReader({ onlyIrreversible: false })
    const block = await reader.getBlock(20)
    expect(postSpy).toBeCalled()
    expect(block).toEqual({
      actions: [
        {
          payload: {
            account: "testing",
            actionIndex: 0,
            authorization: [
              {
                actor: "testing",
                permission: "active",
              },
            ],
            data: {
              memo: "EOS is awesome!",
            },
            name: "action",
            transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
          },
          type: "testing::action",
        },
        {
          payload: {
            account: "testing",
            actionIndex: 1,
            authorization: [
              {
                actor: "testing",
                permission: "active",
              },
            ],
            data: {
              memo: "Go EOS!",
            },
            name: "action2",
            transactionId: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
          },
          type: "testing::action2",
        },
      ],
      blockHash: "000f4241873a9aef0daefd47d8821495b6f61c4d1c73544419eb0ddc22a9e906",
      blockNumber: 20,
      previousBlockHash: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8",
    })
  })
})
