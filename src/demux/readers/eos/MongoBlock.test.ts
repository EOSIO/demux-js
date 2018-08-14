import { MongoBlock } from "./MongoBlock"

const rawBlock = {
  _id: "5b720d6238dda5e3653eb12f",
  block_id: "0001796719f9556dca4dce19f7d83e3c390d76783193d59123706b7741686bac",
  block: {
    timestamp: "2018-08-13T22:59:46.000",
    producer: "eosio",
    confirmed: 0,
    previous: "0001796619c493e432bcf8105d45d1c7457b58f636c89bae3f1bda6574ff7502",
    transaction_mroot: "0000000000000000000000000000000000000000000000000000000000000000",
    action_mroot: "ae806e8b9f4c0740ae77377cca3b187460c3ded54d882accb1c0e90cbfc8d49e",
    schedule_version: 0,
    new_producers: null,
    header_extensions: [],
    producer_signature: `SIG_K1_JuWWv2dyszpR2skBHh6rRk37Ces5WPLCaj7vB2tqe5QqWcBuH
    EwKjttYApYJ27pWwFTp8SQNLS4RogLaGDHX6dCvvHoM8a`,
    transactions: [{
      status: "executed",
      cpu_usage_us: 542,
      net_usage_words: 16,
      trx: {
        id: "051620080b3212292f56a836c6b2f294291f6e6793dc0f12ce6a886f83d97f83",
        signatures: [Array],
        compression: "none",
        packed_context_free_data: "",
        context_free_data: [],
        transaction: {
          expiration: "2018-08-13T23:11:22",
          ref_block_num: 32411,
          ref_block_prefix: 413523387,
          max_net_usage_words: 0,
          max_cpu_usage_ms: 0,
          delay_sec: 0,
          context_free_actions: [],
          actions: [
            {
              account: "eosio.token",
              name: "transfer",
              authorization: [{ actor: "bill", permission: "active" }],
              data: { from: "bill", to: "bob", quantity: "1.0000 EOS", memo: "m" },
              hex_data: "000000000010a33b0000000000000e3d102700000000000004454f5300000000016d",
            },
            {
              account: "eosio.token",
              name: "transfer",
              authorization: [{ actor: "bill", permission: "active" }],
              data: { from: "bill", to: "bob", quantity: "1.0000 EOS", memo: "m" },
              hex_data: "000000000010a33b0000000000000e3d102700000000000004454f5300000000016d",
            },
          ],
          transaction_extensions: [],
        },
      },
    }],
    block_extensions: [],
  },
  block_num: 96615,
  createdAt: "2018-08-13T22:59:46.010Z",
  irreversible: false,
}

describe("MongoBlock", () => {
  let mongoBlock: any

  beforeEach(() => {
    mongoBlock = new MongoBlock(rawBlock)
  })

  it("collects actions from blocks", () => {
    expect(mongoBlock).toEqual({
      actions: [
        {
          payload: {
            account: "eosio.token",
            actionIndex: 0,
            authorization: [
              {
                actor: "bill",
                permission: "active",
              },
            ],
            data: {
              from: "bill",
              memo: "m",
              quantity: "1.0000 EOS",
              to: "bob",
            },
            hex_data: "000000000010a33b0000000000000e3d102700000000000004454f5300000000016d",
            name: "transfer",
            transactionId: "051620080b3212292f56a836c6b2f294291f6e6793dc0f12ce6a886f83d97f83",
          },
          type: "eosio.token::transfer",
        },
        {
          payload: {
            account: "eosio.token",
            actionIndex: 1,
            authorization: [
              {
                actor: "bill",
                permission: "active",
              },
            ],
            data: {
              from: "bill",
              memo: "m",
              quantity: "1.0000 EOS",
              to: "bob",
            },
            hex_data: "000000000010a33b0000000000000e3d102700000000000004454f5300000000016d",
            name: "transfer",
            transactionId: "051620080b3212292f56a836c6b2f294291f6e6793dc0f12ce6a886f83d97f83",
          },
          type: "eosio.token::transfer",
        },
      ],
      blockHash: "0001796719f9556dca4dce19f7d83e3c390d76783193d59123706b7741686bac",
      blockNumber: 96615,
      previousBlockHash: "0001796619c493e432bcf8105d45d1c7457b58f636c89bae3f1bda6574ff7502",
    })
  })
})
