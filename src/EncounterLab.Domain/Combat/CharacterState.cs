namespace EncounterLab.Domain.Combat;

public sealed record CharacterState(
    string Id,
    string Name,
    int Level,
    IReadOnlyList<CharacterClass> Classes,
    AbilityScores Stats,
    HitPointPool HitPoints,
    IReadOnlyDictionary<DamageType, DefenseKind> Defenses,
    int Version)
{
    public IReadOnlyList<CharacterItem> Items { get; init; } = [];

    public CombatDecision ApplyDamage(int amount, DamageType damageType)
    {
        var defense = Defenses.TryGetValue(damageType, out var configured)
            ? configured
            : DefenseKind.None;
        var resolution = HitPoints.ApplyDamage(amount, defense);
        var next = this with { HitPoints = resolution.Next, Version = checked(Version + 1) };

        var summary = defense switch
        {
            DefenseKind.Immunity => $"{Name} ignored {amount} {damageType.ToString().ToLowerInvariant()} damage due to immunity.",
            DefenseKind.Resistance => $"{Name} resisted {amount} {damageType.ToString().ToLowerInvariant()} damage; {resolution.AdjustedDamage} was applied.",
            _ => $"{Name} received {resolution.AdjustedDamage} {damageType.ToString().ToLowerInvariant()} damage."
        };

        var details = new CombatEventDetails
        {
            RequestedDamage = amount,
            AdjustedDamage = resolution.AdjustedDamage,
            DamageType = damageType,
            Defense = defense,
            TemporaryHitPointsConsumed = resolution.TemporaryHitPointsConsumed,
            HitPointsConsumed = resolution.HitPointsConsumed
        };

        return new CombatDecision(
            next,
            UncommittedCombatEvent.Create("DamageApplied", summary, details, next));
    }

    public CombatDecision Heal(int amount)
    {
        var resolution = HitPoints.Heal(amount);
        var next = this with { HitPoints = resolution.Next, Version = checked(Version + 1) };
        var summary = resolution.AppliedHealing == 0
            ? $"{Name} was already at maximum HP."
            : $"{Name} healed {resolution.AppliedHealing} HP.";

        return new CombatDecision(
            next,
            UncommittedCombatEvent.Create(
                "CharacterHealed",
                summary,
                new CombatEventDetails
                {
                    RequestedHealing = amount,
                    AppliedHealing = resolution.AppliedHealing
                },
                next));
    }

    public CombatDecision SetTemporaryHitPoints(int amount)
    {
        var resolution = HitPoints.SetTemporaryHitPoints(amount);
        var next = this with { HitPoints = resolution.Next, Version = checked(Version + 1) };
        var summary = amount <= HitPoints.Temporary
            ? $"{Name} kept {HitPoints.Temporary} temporary HP because the existing value was equal or higher."
            : $"{Name} gained {resolution.AppliedTemporaryHitPoints} temporary HP.";

        return new CombatDecision(
            next,
            UncommittedCombatEvent.Create(
                "TemporaryHitPointsSet",
                summary,
                new CombatEventDetails
                {
                    RequestedTemporaryHitPoints = amount,
                    AppliedTemporaryHitPoints = resolution.AppliedTemporaryHitPoints
                },
                next));
    }

    public CombatDecision ClearTemporaryHitPoints()
    {
        var resolution = HitPoints.ClearTemporaryHitPoints();
        var next = this with { HitPoints = resolution.Next, Version = checked(Version + 1) };
        var summary = resolution.PreviousTemporaryHitPoints == 0
            ? $"{Name}'s temporary HP was already zero."
            : $"{Name}'s temporary HP was cleared.";

        return new CombatDecision(
            next,
            UncommittedCombatEvent.Create(
                "TemporaryHitPointsCleared",
                summary,
                new CombatEventDetails
                {
                    RequestedTemporaryHitPoints = 0,
                    AppliedTemporaryHitPoints = 0
                },
                next));
    }

    public CombatDecision RecordDiceRoll(
        DiceExpression expression,
        IReadOnlyList<int> dice,
        IReadOnlyList<DiceGroupResult> diceGroups,
        int total)
    {
        var next = this with { Version = checked(Version + 1) };
        var summary = $"{Name} rolled {expression}: {total}.";

        return new CombatDecision(
            next,
            UncommittedCombatEvent.Create(
                "DiceRolled",
                summary,
                new CombatEventDetails
                {
                    DiceExpression = expression.ToString(),
                    Dice = dice,
                    DiceGroups = diceGroups,
                    Modifier = expression.Modifier,
                    Total = total
                },
                next));
    }

    public CharacterStateProjection ToProjection() =>
        new(HitPoints.Current, HitPoints.Maximum, HitPoints.Temporary, Version);
}
