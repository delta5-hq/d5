export const deleteDuplications = arr => {
  return Array.from(new Set(arr))
}
