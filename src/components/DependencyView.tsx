import type { Item, Status } from '../types'

// Per-item dependency view: what blocks this (up) and what this would
// unblock (down), as nested lists following the chain. A visited set keeps
// recursion safe even though the editor prevents cycles. No graph library:
// a nested list stays readable at 390px, an edge diagram would not.

// Status dots: a ring at rest, lit accent when in progress, filled quiet
// when done, a faint ring when parked.
const dot: Record<Status, string> = {
  open: 'border border-line-strong',
  in_progress: 'bg-accent shadow-[0_0_8px_var(--color-accent)]',
  done: 'bg-text-3',
  parked: 'border border-line',
}

function related(item: Item, all: Item[], dir: 'up' | 'down'): Item[] {
  if (dir === 'up') {
    return item.dependsOn
      .map((id) => all.find((i) => i.id === id))
      .filter((i): i is Item => i !== undefined)
  }
  return all.filter((i) => i.dependsOn.includes(item.id))
}

interface DepNode {
  item: Item
  children: DepNode[]
}

// Built as a pure step before rendering: a Set mutated during render would
// break under StrictMode's double render and hide every nested branch.
function buildTree(roots: Item[], all: Item[], dir: 'up' | 'down', visited: Set<string>): DepNode[] {
  return roots.map((root) => {
    const next = related(root, all, dir).filter((i) => !visited.has(i.id))
    next.forEach((i) => visited.add(i.id))
    return { item: root, children: buildTree(next, all, dir, visited) }
  })
}

function Branch({ node }: { node: DepNode }) {
  const done = node.item.status === 'done'
  return (
    <li>
      <span className="flex items-center gap-2 text-[13.5px] text-text-2">
        <span className={`size-2 shrink-0 rounded-pill ${dot[node.item.status]}`} />
        <span className={done ? 'text-text-3 line-through' : ''}>{node.item.title}</span>
      </span>
      {node.children.length > 0 && (
        <ul className="ml-[3px] mt-1 space-y-1 border-l border-line pl-4">
          {node.children.map((child) => (
            <Branch key={child.item.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

function Direction({
  heading,
  item,
  all,
  dir,
}: {
  heading: string
  item: Item
  all: Item[]
  dir: 'up' | 'down'
}) {
  const roots = related(item, all, dir)
  if (roots.length === 0) return null
  const visited = new Set<string>([item.id, ...roots.map((r) => r.id)])
  const tree = buildTree(roots, all, dir, visited)
  return (
    <div>
      <h4 className="font-mono text-label uppercase text-text-3">{heading}</h4>
      <ul className="mt-1.5 space-y-1">
        {tree.map((node) => (
          <Branch key={node.item.id} node={node} />
        ))}
      </ul>
    </div>
  )
}

/** Renders nothing when the item has no dependencies in either direction. */
export function DependencyView({ item, allItems }: { item: Item; allItems: Item[] }) {
  const hasUp = item.dependsOn.length > 0
  const hasDown = allItems.some((i) => i.dependsOn.includes(item.id))
  if (!hasUp && !hasDown) return null

  return (
    <div className="space-y-3">
      <Direction heading="Waits on" item={item} all={allItems} dir="up" />
      <Direction heading="Would unblock" item={item} all={allItems} dir="down" />
    </div>
  )
}
