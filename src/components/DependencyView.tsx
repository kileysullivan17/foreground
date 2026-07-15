import type { Item, Status } from '../types'

// Per-item dependency view: what blocks this (up) and what this would
// unblock (down), as nested lists following the chain. A visited set keeps
// recursion safe even though the editor prevents cycles. No graph library:
// a nested list stays readable at 390px, an edge diagram would not.

const dot: Record<Status, string> = {
  open: 'bg-zinc-400',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  parked: 'bg-zinc-300 dark:bg-zinc-600',
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
      <span className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot[node.item.status]}`} />
        <span className={done ? 'text-zinc-400 line-through' : ''}>{node.item.title}</span>
      </span>
      {node.children.length > 0 && (
        <ul className="ml-[3px] mt-1 space-y-1 border-l border-zinc-200 pl-4 dark:border-zinc-700">
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{heading}</h4>
      <ul className="mt-1 space-y-1">
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
