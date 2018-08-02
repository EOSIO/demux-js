function createWitness(state, payload, blockInfo, context) {
  state.witnesses.set(payload.result.data, {
    witness_account: payload.operation.witness_account,
    url: payload.operation.url,
    block_signing_key: payload.operation.block_signing_key,
    created_at_block: blockInfo.blockNumber
  })
}

const updaters = [
  {
    actionType: "witness_create",
    updater: createWitness,
  },
]

module.exports = updaters
