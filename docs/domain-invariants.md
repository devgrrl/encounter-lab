# Domain invariants

- Damage must be greater than zero.
- Healing must be greater than zero.
- Granting temporary HP (`SetTemporaryHitPoints`) requires a positive amount; zero and negative amounts are rejected outright, the same way zero/negative damage and healing are.
- Clearing temporary HP (`ClearTemporaryHitPoints`) is its own unconditional command, not a zero-amount grant. It always resets temporary HP to zero regardless of the current value. It carries no amount at all — there is no requested quantity to validate.
- Immunity reduces matching damage to zero.
- Resistance halves matching damage and rounds down.
- Temporary HP absorbs adjusted damage before current HP.
- Current HP never drops below zero.
- Healing never exceeds maximum HP.
- Healing never restores temporary HP.
- Temporary HP does not stack; only a higher value replaces the existing value.
- The browser never supplies adjusted damage, applied healing, HP totals, defense results, dice outcomes, event sequence, or next version. This holds even when a roll's total becomes the requested amount for a follow-up damage, healing, or temporary-HP command (see `docs/architecture.md`'s "Rolling into the HP engine"): the server still authoritatively rolled the dice, and independently recomputes the HP outcome for the follow-up command exactly as it would for a manually typed amount.
- A duplicate command ID returns its original committed result and is not broadcast again.
- A stale expected version fails rather than silently overwriting newer state.
