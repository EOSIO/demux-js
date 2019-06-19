export const wait = (ms: number, mockCallback?: any): Promise<void> => {
  if (mockCallback === undefined) {
    mockCallback = () => (undefined)
  }
  return new Promise((resolve) => {
    const callback = () => {
      mockCallback()
      resolve()
    }
    setTimeout(callback, ms)
  })
}
