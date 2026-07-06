// Minimal git CLI backed by isomorphic-git.
// Used because this machine's Xcode Command Line Tools are broken (no system git).
// The .git repo it produces is standard and fully compatible with real git.
//
// Usage:
//   node scripts/git.mjs commit "message"   # stage everything + commit
//   node scripts/git.mjs log                # show history
//   node scripts/git.mjs status             # list changed files
import fs from 'node:fs'
import path from 'node:path'
import git from 'isomorphic-git'

const dir = path.resolve(import.meta.dirname, '..')
const author = { name: 'Claude (Fable 5)', email: 'noreply@anthropic.com' }

async function stageAll() {
  const statuses = await git.statusMatrix({ fs, dir })
  for (const [filepath, head, workdir] of statuses) {
    if (workdir === 0 && head !== 0) {
      await git.remove({ fs, dir, filepath })
    } else if (workdir !== 0) {
      await git.add({ fs, dir, filepath })
    }
  }
}

const [cmd, arg] = process.argv.slice(2)

if (cmd === 'commit') {
  if (!arg) throw new Error('commit message required')
  await stageAll()
  const sha = await git.commit({ fs, dir, message: arg, author })
  console.log(`committed ${sha.slice(0, 8)} ${arg.split('\n')[0]}`)
} else if (cmd === 'log') {
  const commits = await git.log({ fs, dir })
  for (const c of commits) {
    console.log(`${c.oid.slice(0, 8)} ${c.commit.message.split('\n')[0]}`)
  }
} else if (cmd === 'status') {
  const statuses = await git.statusMatrix({ fs, dir })
  for (const [filepath, head, workdir, stage] of statuses) {
    if (!(head === 1 && workdir === 1 && stage === 1)) {
      console.log(`${head}${workdir}${stage} ${filepath}`)
    }
  }
} else {
  console.log('usage: node scripts/git.mjs [commit <msg>|log|status]')
}
