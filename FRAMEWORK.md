# The Foreground prioritization framework

Foreground answers one question: what should I work on right now? This
document is the model behind that answer, the weights in it, and why each
one is set where it is. The implementation is `src/scoring/score.ts` (items)
and `src/scoring/wsjf.ts` (backlog stories); the code and this document are
kept in sync deliberately.

## The shape of the model

Foreground uses WSJF (Weighted Shortest Job First), adapted for a personal
tool. Classic WSJF ranks work by cost of delay divided by job size: do the
thing whose delay hurts most per unit of effort. Foreground keeps that core
and adds one thing WSJF does not have, a staleness multiplier, because the
problem this product exists to solve is work that quietly rots while fresher
work jumps the queue.

```
priority = cost of delay ÷ job size × staleness multiplier
```

Every number a card shows traces to a named factor with a plain-language
label. If the ranking ever surprises you, the card itself must contain
enough to either trust it or fix the input it came from. That constraint
shaped several choices below.

## Cost of delay

Four additive components, each with a budget. The budgets encode a strict
opinion about what beats what.

**Deadline urgency, up to 35 points.** Overdue pegs the full 35, due today
scores 32, and the curve falls roughly linearly to 2 points past thirty
days out. This is the largest budget because a real calendar consequence
should beat every soft signal in the system. The steepness near zero is
intentional: the difference between "due in 2 days" and "due in 9 days"
matters far more than between 20 and 27.

**Importance, up to 25 points.** The 1..5 rating maps linearly (about 6.25
points per step above 1). Second-largest budget: what you declared matters
should usually outrank what merely lingers, but never outrank a deadline
about to land.

**Unblock value, up to 20 points.** 8 points per open item waiting on this
one, capped at 20. Dependencies make this bigger than staleness ever gets:
finishing a blocker buys progress on several fronts at once, and the label
names exactly what it frees up ("Holding up 'Book the insulation
install'"). The counterpart rule: an item whose own dependencies are
unfinished is not ranked lower, it is removed from the ready list entirely.
Ranking a thing you cannot start is a lie; the top of What Now must always
be startable.

**Momentum, 6 points.** In-progress items get a small nudge because
abandoning started work costs context twice, once putting it down and once
picking it back up. Deliberately small: it breaks ties, it does not trap
you in yesterday's choices.

## Job size

Effort divides. Small = 1, Medium = 2, Large = 3, so a medium job needs
twice the cost of delay to hold the same rank as a small one. This is the
WSJF trade: two urgent-ish small things usually beat one big thing started
late in the day. A consequence worth stating honestly: a big job with a
near deadline can rank below a small stale item.

What a deadline guarantees is narrower than "deadlines always win", and it
is worth being exact about. Staleness is a multiplier, so it can only
amplify cost of delay an item already has; applied to an item with none it
changes nothing. A deadline always carries deadline points, so it beats any
staleness-boosted *trivial* item, one whose own cost of delay is essentially
zero (lowest importance, nothing waiting on it, not in progress): that item
scores zero no matter how long it has been ignored, because the multiplier
has nothing to act on. What a deadline does not do is beat an *important*
item that happens to be stale, because that item has real cost of delay for
staleness to amplify. So an important, long-ignored task with no deadline can
outrank a far-off deadline, and that is intended. The boundary, a bare
deadline beating a maximally stale trivial item, is pinned by a test.

The quick-wins toggle steepens the divisors to 1 / 3 / 6 for a low-energy
hour. Big jobs actively sink rather than merely failing to rise, and the
size label says why in both directions ("Small job, good for right now";
"Big job, wrong time for it").

## The staleness multiplier

The differentiator. After a three-day grace period, an item's whole
score is multiplied by `1 + days untouched ÷ 60`, capped at 1.5 from day
thirty on.

It is a multiplier, not an addend, and that choice carries the product's
point of view. Additive staleness (v1 did this) manufactures points from
age alone, so a trivial item can eventually leapfrog fresh critical work
just by being ignored hard enough. Multiplicative staleness amplifies what
is already at stake: an important put-off thing climbs loudly, a trivial
put-off thing climbs in proportion to its actual worth. Age makes the
signal louder; it does not invent one.

The three-day grace keeps every card from carrying a noise factor from day
one. The cap keeps a forgotten item from growing without bound. Touching an
item in any way (a status change, or "Touch it" with a one-line note in the
Stuff I've Put Off view) resets the clock, so the boost is always earned by
genuine neglect.

For work that should not climb at all, parking exists: parked items leave
the ranking entirely and wait, unscored, until reopened.

## The same model at backlog zoom

Stories in the Product module use plain WSJF, no staleness, because a
backlog item that sits untouched is just a backlog item.

```
WSJF = (business value + time criticality + enablement) ÷ job size
```

The three inputs are 1..5 each, mirroring the cost-of-delay components at
lower resolution: value for the user or the portfolio, the cost of doing
it later instead of now, and how much other work it unblocks or de-risks.
Job size is story points in {1, 2, 3, 5, 8}. Each story card shows the
arithmetic in full ("cost of delay 12 = value 5 + urgency 4 + unblocks 3,
÷ size 3").

## What the framework refuses to do

No machine learning, no hidden decay curves, no weights that adjust
themselves. A prioritization tool earns trust by being auditable, and a
personal one earns daily use by being predictable. Every choice above is a
constant in one file, and changing an opinion means changing a number whose
consequences the test suite pins down.
