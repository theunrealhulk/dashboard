import type { Dataset } from '../types'
import { cellKey } from './values'

export type RelationshipCardinality =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many'

export interface RelationshipCandidate {
  id: string
  from: Dataset
  to: Dataset
  fromColumn: string
  toColumn: string
  cardinality: RelationshipCardinality
  fromDistinct: number
  toDistinct: number
  fromUnique: boolean
  toUnique: boolean
  toHasNulls: boolean
  linkingSide: 'from' | 'to'
}

interface ColumnProfile {
  keys: Set<string>
  nonNull: number
  nulls: number
  unique: boolean
}

function profileDataset(dataset: Dataset): Map<string, ColumnProfile> {
  const profiles = new Map<string, ColumnProfile>()

  for (const column of dataset.columns) {
    const keys = new Set<string>()
    let nonNull = 0

    for (const row of dataset.rows) {
      const key = cellKey(row[column])
      if (key === null) continue
      keys.add(key)
      nonNull += 1
    }

    profiles.set(column, {
      keys,
      nonNull,
      nulls: dataset.rows.length - nonNull,
      unique: nonNull === keys.size,
    })
  }

  return profiles
}

function cardinalityFor(
  fromUnique: boolean,
  toUnique: boolean,
): RelationshipCardinality {
  if (fromUnique && toUnique) return 'one-to-one'
  if (fromUnique && !toUnique) return 'one-to-many'
  if (!fromUnique && toUnique) return 'many-to-one'
  return 'many-to-many'
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/id$/, '')
}

function nameMatchScore(left: string, right: string): number {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a === b) return 3

  const na = normalizeName(left)
  const nb = normalizeName(right)
  if (na !== '' && na === nb) return 2
  if (na !== '' && nb !== '' && (na.includes(nb) || nb.includes(na))) {
    return 1
  }
  return 0
}

interface ScoredCandidate extends RelationshipCandidate {
  score: number
}

function findDirection(
  from: Dataset,
  to: Dataset,
  fromProfiles: Map<string, ColumnProfile>,
  toProfiles: Map<string, ColumnProfile>,
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = []

  for (const [fromColumn, fromProfile] of fromProfiles) {
    if (fromProfile.keys.size < 2) continue

    for (const [toColumn, toProfile] of toProfiles) {
      if (toProfile.keys.size < fromProfile.keys.size) continue

      let isSubset = true
      for (const key of fromProfile.keys) {
        if (!toProfile.keys.has(key)) {
          isSubset = false
          break
        }
      }
      if (!isSubset) continue

      const fromUnique = fromProfile.unique
      const toUnique = toProfile.unique
      const cardinality = cardinalityFor(fromUnique, toUnique)
      const nameScore = nameMatchScore(fromColumn, toColumn)

      candidates.push({
        id: `${from.id}:${fromColumn}->${to.id}:${toColumn}`,
        from,
        to,
        fromColumn,
        toColumn,
        cardinality,
        fromDistinct: fromProfile.keys.size,
        toDistinct: toProfile.keys.size,
        fromUnique,
        toUnique,
        toHasNulls: toProfile.nulls > 0,
        linkingSide: 'from',
        score:
          (toUnique ? 100 : 0) +
          nameScore * 20 +
          (fromUnique ? 10 : 0) +
          (cardinality === 'one-to-one' ? 5 : 0),
      })
    }
  }

  return candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.fromDistinct - b.fromDistinct ||
      a.fromColumn.localeCompare(b.fromColumn) ||
      a.toColumn.localeCompare(b.toColumn),
  )
}

export function findRelationships(
  first: Dataset,
  second: Dataset,
): RelationshipCandidate[] {
  const firstProfiles = profileDataset(first)
  const secondProfiles = profileDataset(second)

  return [
    ...findDirection(first, second, firstProfiles, secondProfiles),
    ...findDirection(second, first, secondProfiles, firstProfiles),
  ].map(({ score: _score, ...candidate }) => candidate)
}
