import { BitsharesActionReader } from "./BitsharesActionReader"

const rawBlock = {
  "previous": "01ba7e5fb3e971f9605380fe046dedd44ff579d5",
  "timestamp": "2018-07-24T08:51:15",
  "witness": "1.6.16",
  "transaction_merkle_root": "0e01a82552adf49e782d5b99d0a7fde9873fc3ad",
  "extensions": [],
  "witness_signature": "207ee38b61aa94dd5e19793ff79573902abbbc546f2faeb404d3bf1b8a89648cdc7caadf554495fa283c3d6fabeea9a31cf594db889e0d28302a6222f42770f201",
  "transactions": [
    {
      "ref_block_num": 32350,
      "ref_block_prefix": 3241438644,
      "expiration": "2018-07-24T08:51:27",
      "operations": [
        [
          2,
          {
            "fee": {
              "amount": 57,
              "asset_id": "1.3.0"
            },
            "fee_paying_account": "1.2.959121",
            "order": "1.7.131695145",
            "extensions": []
          }
        ]
      ],
      "extensions": [],
      "signatures": [
        "1f05bfa5aa90bd213bdd64dd3cc27ced5652034dad3618045379588f387bc416304f382da38ec6486a16d9162d3ea0d706f6ee1efccd1be61b4db66786a6ba07f6"
      ],
      "operation_results": [
        [
          2,
          {
            "amount": "5006408241",
            "asset_id": "1.3.3869"
          }
        ]
      ]
    }
  ]
}

describe("BitsharesActionReader", () => {
  let request: any
  let reader: BitsharesActionReader

  const blockInfo = {
    last_irreversible_block_num: 28999200,
    head_block_number: 28999264,
  }

  beforeAll(() => {
    request = {
      post: async (requestParams: any) => {
        switch (requestParams.json.method) {
          case 'get_dynamic_global_properties': return { result: blockInfo }
          case 'get_block': return { result: rawBlock }
          default: return undefined
        }
      }
    }
  })

  beforeEach(() => {
    reader = new BitsharesActionReader("", 1, false, 600, request)
  })

  it("returns last irreversible block if configured", async () => {
    reader = new BitsharesActionReader("", 1, true, 600, request)
    const blockNum = await reader.getHeadBlockNumber()
    expect(blockNum).toBe(28999200)
  })

  it("returns head block if configured", async () => {
    const blockNum = await reader.getHeadBlockNumber()
    expect(blockNum).toBe(28999264)
  })

  it("gets a block", async () => {
    const block = await reader.getBlock(28999264)
    expect(block).toEqual({
      "blockHash": "28999264",
      "blockNumber": 28999264,
      "previousBlockHash": "28999263",
      "actions": [
          {
              "type": "limit_order_cancel",
              "payload": {
                  "transactionIndex": 0,
                  "operationIndex": 0,
                  "operation": {
                      "extensions": [],
                      "fee": {
                          "amount": 57,
                          "asset_id": "1.3.0"
                      },
                      "fee_paying_account": "1.2.959121",
                      "order": "1.7.131695145"
                  },
                  "result": {
                      "type": "asset",
                      "data": {
                          "amount": "5006408241",
                          "asset_id": "1.3.3869"
                      }
                  }
              }
          }
      ]
    })
  })
})
