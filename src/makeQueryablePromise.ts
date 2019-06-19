export interface QueryablePromise<T> extends Promise<T> {
  isFulfilled(): boolean
  isPending(): boolean
  isRejected(): boolean
  value(): any
  error(): Error | null
}

export const makeQuerablePromise = <T>(promise: Promise<T>, throwOnError: boolean = true): QueryablePromise<T> => {
  let isPending = true
  let isRejected = false
  let isFulfilled = false
  let value: any = null
  let error: Error | null = null

  const result = promise.then(
    (fulfilledValue: any) => {
      isFulfilled = true
      isPending = false
      value = fulfilledValue
      return fulfilledValue
    },
    (err: Error) => {
      isRejected = true
      isPending = false
      error = err
      if (throwOnError) {
        throw err
      }
    }
  ) as QueryablePromise<T>

  result.isFulfilled = () => isFulfilled
  result.isPending = () => isPending
  result.isRejected = () => isRejected
  result.value = () => value
  result.error = () => error
  return result
}
