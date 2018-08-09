import { BitsharesBlock } from "./BitsharesBlock"

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
    },
    {
      "ref_block_num": 32351,
      "ref_block_prefix": 4184992179,
      "expiration": "2018-07-24T08:51:42",
      "operations": [
        [
          1,
          {
            "fee": {
              "amount": 578,
              "asset_id": "1.3.0"
            },
            "seller": "1.2.1017154",
            "amount_to_sell": {
              "amount": 1983,
              "asset_id": "1.3.0"
            },
            "min_to_receive": {
              "amount": "718409576261824",
              "asset_id": "1.3.100"
            },
            "expiration": "2018-07-24T08:51:42",
            "fill_or_kill": false,
            "extensions": []
          }
        ],
        [
          1,
          {
            "fee": {
              "amount": 578,
              "asset_id": "1.3.0"
            },
            "seller": "1.2.1017154",
            "amount_to_sell": {
              "amount": 952,
              "asset_id": "1.3.0"
            },
            "min_to_receive": {
              "amount": "753609593139927",
              "asset_id": "1.3.101"
            },
            "expiration": "2018-07-24T08:51:42",
            "fill_or_kill": false,
            "extensions": []
          }
        ],
        [
          1,
          {
            "fee": {
              "amount": 578,
              "asset_id": "1.3.0"
            },
            "seller": "1.2.1017154",
            "amount_to_sell": {
              "amount": 1599,
              "asset_id": "1.3.0"
            },
            "min_to_receive": {
              "amount": "859553061985962",
              "asset_id": "1.3.102"
            },
            "expiration": "2018-07-24T08:51:42",
            "fill_or_kill": false,
            "extensions": []
          }
        ],
      ],
      "extensions": [],
      "signatures": [
        "1f6b3e332915a9bd753a3f3a0f770292c8b30251a06c127c6e4fd28cf4d20656925232e5cccf80f78d274754e89ecdc10695f86b22b9c54b0aa813de05b209b06f"
      ],
      "operation_results": [
        [
          1,
          "1.7.131695953"
        ],
        [
          1,
          "1.7.131695954"
        ],
        [
          1,
          "1.7.131695955"
        ],
      ]
    },
    {
      "ref_block_num": 32350,
      "ref_block_prefix": 3241438644,
      "expiration": "2018-07-24T08:51:39",
      "operations": [
        [
          20,
          {
            "fee": {
              "amount": 28945924,
              "asset_id": "1.3.0"
            },
            "witness_account": "1.2.987999",
            "url": "TBD",
            "block_signing_key": "BTS7xgNpgGXwpdozRVZaSAv8wP8Wknz3TjFjojgmXfvfts2YbSF9v"
          }
        ]
      ],
      "extensions": [],
      "signatures": [
        "1f0c9b0aabbdd6c60514c26825d072e1ef4864c610ce727bc0686ca404e428970c24b98f7bcb2c1c034a439b6931f5209e6bf2dd8e0d39d0c4eb1704a91cf8fb0b"
      ],
      "operation_results": [
        [
          1,
          "1.6.129"
        ]
      ]
    }
  ]
}

describe("BitsharesBlock", () => {
  let btsBlock: BitsharesBlock

  beforeEach(() => {
    btsBlock = new BitsharesBlock(28999264, rawBlock)
  })

  it("collects actions from blocks", async () => {
    const { actions } = btsBlock
    expect(actions).toEqual([
        {
            "type": "limit_order_cancel",
            "payload": {
                "transactionIndex": 0,
                "operationIndex": 0,
                "operation": {
                    "fee": {
                        "amount": 57,
                        "asset_id": "1.3.0"
                    },
                    "fee_paying_account": "1.2.959121",
                    "order": "1.7.131695145",
                    "extensions": []
                },
                "result": {
                    "type": "asset",
                    "data": {
                        "amount": "5006408241",
                        "asset_id": "1.3.3869"
                    },
                },
            },
        },
        {
            "payload": {
                "transactionIndex": 1,
                "operationIndex": 0,
                "operation": {
                    "amount_to_sell": {
                        "amount": 1983,
                        "asset_id": "1.3.0"
                    },
                    "expiration": "2018-07-24T08:51:42",
                    "fee": {
                        "amount": 578,
                        "asset_id": "1.3.0"
                    },
                    "fill_or_kill": false,
                    "min_to_receive": {
                        "amount": "718409576261824",
                        "asset_id": "1.3.100"
                    },
                    "seller": "1.2.1017154",
                    "extensions": []
                },
                "result": {
                    "data": "1.7.131695953",
                    "type": "object_id_type"
                },
            },
            "type": "limit_order_create"
        },
        {
            "type": "limit_order_create",
            "payload": {
                "transactionIndex": 1,
                "operationIndex": 1,
                "operation": {
                    "amount_to_sell": {
                        "amount": 952,
                        "asset_id": "1.3.0"
                    },
                    "expiration": "2018-07-24T08:51:42",
                    "extensions": [],
                    "fee": {
                        "amount": 578,
                        "asset_id": "1.3.0"
                    },
                    "fill_or_kill": false,
                    "min_to_receive": {
                        "amount": "753609593139927",
                        "asset_id": "1.3.101"
                    },
                    "seller": "1.2.1017154"
                },
                "result": {
                    "data": "1.7.131695954",
                    "type": "object_id_type"
                },
            },
        },
        {
            "type": "limit_order_create",
            "payload": {
                "transactionIndex": 1,
                "operationIndex": 2,
                "operation": {
                    "amount_to_sell": {
                        "amount": 1599,
                        "asset_id": "1.3.0"
                    },
                    "expiration": "2018-07-24T08:51:42",
                    "extensions": [],
                    "fee": {
                        "amount": 578,
                        "asset_id": "1.3.0"
                    },
                    "fill_or_kill": false,
                    "min_to_receive": {
                        "amount": "859553061985962",
                        "asset_id": "1.3.102"
                    },
                    "seller": "1.2.1017154"
                },
                "result": {
                    "data": "1.7.131695955",
                    "type": "object_id_type"
                },
            },
        },
        {
            "type": "witness_create",
            "payload": {
                "transactionIndex": 2,
                "operationIndex": 0,
                "operation": {
                    "block_signing_key": "BTS7xgNpgGXwpdozRVZaSAv8wP8Wknz3TjFjojgmXfvfts2YbSF9v",
                    "fee": {
                        "amount": 28945924,
                        "asset_id": "1.3.0"
                    },
                    "url": "TBD",
                    "witness_account": "1.2.987999"
                },
                "result": {
                    "data": "1.6.129",
                    "type": "object_id_type"
                },
            },
        }
    ])
  })
})
