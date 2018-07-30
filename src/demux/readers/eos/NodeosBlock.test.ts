import { NodeosBlock } from "./NodeosBlock"

const rawBlock = {
  timestamp: "2018-06-16T05:59:49.500",
  producer: "eoscafeblock",
  confirmed: 0,
  previous: "000f42401b5636c3c1d88f31fe0e503654091fb822b0ffe21c7d35837fc9f3d8",
  transaction_mroot: "dba47962ea4d721368e5853cd48d3db600277b8c8bd126843ba1fb5c30260450",
  action_mroot: "c518c3e37a893a29d643080034ed1514c83e808bd2c107aa39e38adfc774c919",
  schedule_version: 10,
  new_producers: null,
  header_extensions: [],
  // tslint:disable-next-line
  producer_signature: "SIG_K1_K9KpBPcbHukPLLqpt27vkLoYHwVnukBSijEvksdWUmN4Boi2EHwd7B6RC7kcBvXCgHptvp1QDyaiAY3FxRiHoapvzCcFAU",
  transactions: [
    {
      status: "executed",
      cpu_usage_us: 778,
      net_usage_words: 14,
      trx: {
        id: "b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533",
        signatures: [
          "SIG_K1_KbzyGju8Ssn16KxRA5nJg1P4X5MfoGgs8MfBi4NuhSCrG7oCuoCGVg8vnSqsocYouDYawxpQ31BrxJGVR5xEfoVpEV5jqV",
        ],
        compression: "none",
        packed_context_free_data: "",
        context_free_data: [],
        // tslint:disable-next-line
        packed_trx: "c5ae245bf9404eadf12c0000000001a09861f648958566000000000080694a01a09861f64895856600000000a8ed3232141364646f7320656f73212073686f727420656f7300",
        transaction: {
          expiration: "2018-06-16T06:31:33",
          ref_block_num: 16633,
          ref_block_prefix: 754036046,
          max_net_usage_words: 0,
          max_cpu_usage_ms: 0,
          delay_sec: 0,
          context_free_actions: [],
          actions: [
            {
              account: "testing",
              name: "action",
              authorization: [
                {
                  actor: "testing",
                  permission: "active",
                },
              ],
              data: {
                memo: "EOS is awesome!",
              },
              hex_data: "1364646f7320656f73212073686f727420656f73",
            },
            {
              account: "testing",
              name: "action2",
              authorization: [
                {
                  actor: "testing",
                  permission: "active",
                },
              ],
              data: {
                memo: "Go EOS!",
              },
              hex_data: "1364646f7320656f73212073686f727420656f73",
            },
          ],
          transaction_extensions: [],
        },
      },
    },
  ],
  block_extensions: [],
  id: "000f4241873a9aef0daefd47d8821495b6f61c4d1c73544419eb0ddc22a9e906",
  block_num: 20,
  ref_block_prefix: 1207807501,
}

describe("NodeosBlock", () => {
  let eosBlock: NodeosBlock

  beforeEach(() => {
    eosBlock = new NodeosBlock(rawBlock)
  })

  it("collects actions from blocks", async () => {
    const { actions } = eosBlock
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
})
