import type { Place } from './types'

const exactOptimizationLimit = 16

export async function optimizeRouteOrder(
  origin: [number, number],
  places: Place[],
  signal: AbortSignal,
): Promise<string[]> {
  const coordinates = [origin, ...places.map((place) => place.coordinates)]
  const waypoints = coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';')
  const response = await fetch(
    `https://router.project-osrm.org/table/v1/driving/${waypoints}?annotations=distance`,
    { signal },
  )
  if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`)

  const result: unknown = await response.json()
  if (
    typeof result !== 'object' ||
    result === null ||
    !('code' in result) ||
    result.code !== 'Ok' ||
    !('distances' in result) ||
    !Array.isArray(result.distances)
  ) {
    throw new Error('Routing service returned no distance table.')
  }

  const distances = result.distances.map((row): number[] => {
    if (!Array.isArray(row) || row.length !== coordinates.length) {
      throw new Error('Routing service returned an invalid distance table.')
    }
    return row.map((distance) =>
      typeof distance === 'number' && Number.isFinite(distance) && distance >= 0
        ? distance
        : Number.POSITIVE_INFINITY,
    )
  })
  if (distances.length !== coordinates.length) {
    throw new Error('Routing service returned an invalid distance table.')
  }

  const stopOrder = distances.length - 1 <= exactOptimizationLimit
    ? findShortestExactOrder(distances)
    : findShortestApproximateOrder(distances)
  return stopOrder.map((index) => places[index - 1].id)
}

function findShortestExactOrder(distances: number[][]): number[] {
  const stopCount = distances.length - 1
  const stateCount = 1 << stopCount
  const costs = new Float64Array(stateCount * stopCount)
  costs.fill(Number.POSITIVE_INFINITY)
  const previousStops = new Int16Array(stateCount * stopCount)
  previousStops.fill(-1)

  for (let mask = 1; mask < stateCount; mask += 1) {
    for (let last = 0; last < stopCount; last += 1) {
      const lastBit = 1 << last
      if ((mask & lastBit) === 0) continue

      const previousMask = mask ^ lastBit
      const stateIndex = mask * stopCount + last
      if (previousMask === 0) {
        costs[stateIndex] = distances[0][last + 1]
        continue
      }

      for (let previous = 0; previous < stopCount; previous += 1) {
        if ((previousMask & (1 << previous)) === 0) continue
        const candidate = costs[previousMask * stopCount + previous] + distances[previous + 1][last + 1]
        if (candidate < costs[stateIndex]) {
          costs[stateIndex] = candidate
          previousStops[stateIndex] = previous
        }
      }
    }
  }

  const fullMask = stateCount - 1
  let lastStop = -1
  let shortestDistance = Number.POSITIVE_INFINITY
  for (let last = 0; last < stopCount; last += 1) {
    const candidate = costs[fullMask * stopCount + last]
    if (candidate < shortestDistance) {
      shortestDistance = candidate
      lastStop = last
    }
  }
  if (lastStop === -1 || !Number.isFinite(shortestDistance)) {
    throw new Error('No drivable route connects all selected stops.')
  }

  const order = new Array<number>(stopCount)
  let mask = fullMask
  for (let index = stopCount - 1; index >= 0; index -= 1) {
    order[index] = lastStop + 1
    const previous = previousStops[mask * stopCount + lastStop]
    mask ^= 1 << lastStop
    lastStop = previous
  }
  return order
}

function findShortestApproximateOrder(distances: number[][]): number[] {
  const remaining = new Set(Array.from({ length: distances.length - 1 }, (_, index) => index + 1))
  const order: number[] = []
  let current = 0
  while (remaining.size > 0) {
    let nearest = -1
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const stop of remaining) {
      if (distances[current][stop] < nearestDistance) {
        nearest = stop
        nearestDistance = distances[current][stop]
      }
    }
    if (nearest === -1 || !Number.isFinite(nearestDistance)) {
      throw new Error('No drivable route connects all selected stops.')
    }
    order.push(nearest)
    remaining.delete(nearest)
    current = nearest
  }

  let improved = true
  while (improved) {
    improved = false
    for (let start = 0; start < order.length - 1 && !improved; start += 1) {
      for (let end = start + 1; end < order.length; end += 1) {
        const candidate = [...order]
        candidate.splice(start, end - start + 1, ...candidate.slice(start, end + 1).reverse())
        if (getRouteDistance(distances, candidate) + 0.01 < getRouteDistance(distances, order)) {
          order.splice(0, order.length, ...candidate)
          improved = true
          break
        }
      }
    }
  }
  return order
}

function getRouteDistance(distances: number[][], order: number[]) {
  let total = 0
  let previous = 0
  for (const stop of order) {
    total += distances[previous][stop]
    previous = stop
  }
  return total
}
