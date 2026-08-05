namespace EncounterLab.Domain.Combat;

public sealed record DiceGroupResult(
    string Expression,
    IReadOnlyList<int> Dice,
    int Total);

public sealed record CombatEventDetails
{
    public int? RequestedDamage { get; init; }
    public int? AdjustedDamage { get; init; }
    public DamageType? DamageType { get; init; }
    public DefenseKind? Defense { get; init; }
    public int? TemporaryHitPointsConsumed { get; init; }
    public int? HitPointsConsumed { get; init; }
    public int? RequestedHealing { get; init; }
    public int? AppliedHealing { get; init; }
    public int? RequestedTemporaryHitPoints { get; init; }
    public int? AppliedTemporaryHitPoints { get; init; }
    public string? DiceExpression { get; init; }
    public IReadOnlyList<int>? Dice { get; init; }
    public IReadOnlyList<DiceGroupResult>? DiceGroups { get; init; }
    public int? Modifier { get; init; }
    public int? Total { get; init; }
}
