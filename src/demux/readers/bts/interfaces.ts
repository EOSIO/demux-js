import { Action } from "../../../../index"

// See graphene/chain/protocol/operation.hpp .
export enum OperationType {
  transfer,
  limit_order_create,
  limit_order_cancel,
  call_order_update,
  fill_order,           // VIRTUAL
  account_create,
  account_update,
  account_whitelist,
  account_upgrade,
  account_transfer,
  asset_create,
  asset_update,
  asset_update_bitasset,
  asset_update_feed_producers,
  asset_issue,
  asset_reserve,
  asset_fund_fee_pool,
  asset_settle,
  asset_global_settle,
  asset_publish_feed,
  witness_create,
  witness_update,
  proposal_create,
  proposal_update,
  proposal_delete,
  withdraw_permission_create,
  withdraw_permission_update,
  withdraw_permission_claim,
  withdraw_permission_delete,
  committee_member_create,
  committee_member_update,
  committee_member_update_global_parameters,
  vesting_balance_create,
  vesting_balance_withdraw,
  worker_create,
  custom,
  assert,
  balance_claim,
  override_transfer,
  transfer_to_blind,
  blind_transfer,
  transfer_from_blind,
  asset_settle_cancel,  // VIRTUAL
  asset_claim_fees,
  fba_distribute,       // VIRTUAL
  bid_collateral,
  execute_bid,          // VIRTUAL
  asset_claim_pool,
  asset_update_issuer
}

export enum OperationResultType {
  void_result,
  object_id_type,
  asset
}

export interface OperationResult {
  type: OperationResultType
  data: any
}

export interface BitsharesPayload {
  transactionIndex: number
  operationIndex: number
  operation: any
  result: OperationResult
}

export interface BitsharesAction extends Action {
  payload: BitsharesPayload
}
