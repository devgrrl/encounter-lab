# Domain invariants

- Damage must be greater than zero.
- Healing must be greater than zero.
- Temporary HP requests cannot be negative.
- Immunity reduces matching damage to zero.
- Resistance halves matching damage and rounds down.
- Temporary HP absorbs adjusted damage before current HP.
- Current HP never drops below zero.
- Healing never exceeds maximum HP.
- Healing never restores temporary HP.
- Temporary HP does not stack; only a higher value replaces the existing value.
- A temporary HP request of exactly zero is an explicit, unconditional clear — it always sets temporary HP to zero, regardless of the current value.
- The browser never supplies adjusted damage, applied healing, HP totals, defense results, dice outcomes, event sequence, or next version.
- A duplicate command ID returns its original committed result and is not broadcast again.
- A stale expected version fails rather than silently overwriting newer state.
