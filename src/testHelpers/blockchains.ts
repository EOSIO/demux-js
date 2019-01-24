export default {
  blockchain: [
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: 1,
        previousBlockHash: '',
        timestamp: new Date('2018-06-06T11:53:37.000'),
      },
      actions: [
        {
          payload: {
            account: 'testing',
            actionIndex: 0,
            authorization: [
              {
                actor: 'testing',
                permission: 'active',
              },
            ],
            data: {
              memo: 'EOS is awesome!',
            },
            name: 'action',
            transactionId: 'b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533',
          },
          type: 'testing::action',
        },
        {
          payload: {
            account: 'testing',
            actionIndex: 1,
            authorization: [
              {
                actor: 'testing',
                permission: 'active',
              },
            ],
            data: {
              memo: 'Go EOS!',
            },
            name: 'action2',
            transactionId: 'b890beb84a6d1d77755f2e0cdad48e2ffcfd06ff3481917b4875cc5f3a343533',
          },
          type: 'testing::action2',
        },
      ],
    },
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        blockNumber: 2,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: new Date('2018-06-06T11:53:37.500'),
      },
      actions: [
        {
          payload: {
            account: 'eosio.token',
            actionIndex: 0,
            authorization: [],
            data: {
              quantity: {
                amount: '42.00000',
                symbol: 'EOS',
              },
            },
            name: 'transfer',
            transactionId: '1',
          },
          type: 'eosio.token::transfer',
        },
        {
          payload: {
            account: 'eosio.system',
            actionIndex: 0,
            authorization: [],
            data: {},
            name: 'regproducer',
            transactionId: '1',
          },
          type: 'eosio.system::regproducer',
        },
        {
          payload: {
            account: 'eosio',
            actionIndex: 0,
            authorization: [],
            data: {
              bidder: 'qwertyuiopas',
              newname: 'a',
              bid: '20000.0000 EOS',
            },
            name: 'transfer',
            transactionId: '1',
          },
          type: 'eosio::bidname',
        },
      ],
    },
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000002',
        blockNumber: 3,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        timestamp: new Date('2018-06-06T11:53:38.000'),
      },
      actions: [
        {
          payload: {
            account: 'eosio.token',
            actionIndex: 0,
            authorization: [],
            data: {
              quantity: {
                amount: '24.00000',
                symbol: 'EOS',
              },
            },
            name: 'transfer',
            transactionId: '1',
          },
          type: 'eosio.token::transfer',
        },
      ],
    },
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000003',
        blockNumber: 4,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000002',
        timestamp: new Date('2018-06-06T11:53:39.000'),
      },
      actions: [],
    },
  ],
  forked: [
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: 1,
        previousBlockHash: '',
        timestamp: new Date('2018-06-06T11:53:37.000'),
      },
      actions: [],
    },
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        blockNumber: 2,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: new Date('2018-06-06T11:53:37.500'),
      },
      actions: [],
    },
    {
      blockInfo: {
        blockHash: 'foo',
        blockNumber: 3,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        timestamp: new Date('2018-06-06T11:53:38.000'),
      },
      actions: [],
    },
    {
      blockInfo: {
        blockHash: 'wrench',
        blockNumber: 4,
        previousBlockHash: 'foo',
        timestamp: new Date('2018-06-06T11:53:38.500'),
      },
      actions: [],
    },
    {
      blockInfo: {
        blockHash: 'madeit',
        blockNumber: 5,
        previousBlockHash: 'wrench',
        timestamp: new Date('2018-06-06T11:53:39.000'),
      },
      actions: [],
    },
  ],
  upgradeHandler: [
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        blockNumber: 2,
        previousBlockHash: '',
        timestamp: new Date('2018-06-06T11:53:37.500'),
      },
      actions: [
        {
          payload: {
            account: 'eosio.token',
            actionIndex: 0,
            authorization: [],
            data: {
              quantity: {
                amount: '42.00000',
                symbol: 'EOS',
              },
            },
            name: 'transfer',
            transactionId: '1',
          },
          type: 'eosio.token::transfer',
        },
        {
          payload: {
            account: 'eosio',
            actionIndex: 0,
            authorization: [],
            data: {
              bidder: 'qwertyuiopas',
              newname: 'a',
              bid: '20000.0000 EOS',
            },
            name: 'transfer',
            transactionId: '1',
          },
          type: 'eosio::bidname',
        },
        {
          payload: {
            account: 'mycontract',
            actionIndex: 1,
            authorization: [],
            data: { versionName: 'v2' },
            name: 'upgrade',
            transactionId: '1',
          },
          type: 'mycontract::upgrade',
        },
        {
          payload: {
            account: 'eosio.token',
            actionIndex: 2,
            authorization: [],
            data: {
              quantity: {
                amount: '42.00000',
                symbol: 'EOS',
              },
            },
            name: 'issue',
            transactionId: '1',
          },
          type: 'eosio.token::issue',
        },
      ],
    },
    {
      blockInfo: {
        blockHash: '0000000000000000000000000000000000000000000000000000000000000002',
        blockNumber: 3,
        previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000001',
        timestamp: new Date('2018-06-06T11:53:38.000'),
      },
      actions: [],
    },
  ],
}
