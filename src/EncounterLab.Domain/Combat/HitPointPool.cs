namespace EncounterLab.Domain.Combat;

public sealed record HitPointPool
{
    public HitPointPool(int current, int maximum, int temporary = 0)
    {
        if (maximum <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximum), "Maximum HP must be greater than zero.");
        }

        if (current is < 0 || current > maximum)
        {
            throw new ArgumentOutOfRangeException(nameof(current), "Current HP must be between zero and maximum HP.");
        }

        if (temporary < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(temporary), "Temporary HP cannot be negative.");
        }

        Current = current;
        Maximum = maximum;
        Temporary = temporary;
    }

    public int Current { get; }
    public int Maximum { get; }
    public int Temporary { get; }

    public DamageResolution ApplyDamage(int requestedDamage, DefenseKind defense)
    {
        if (requestedDamage <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(requestedDamage), "Damage must be greater than zero.");
        }

        var adjustedDamage = defense switch
        {
            DefenseKind.Immunity => 0,
            DefenseKind.Resistance => requestedDamage / 2,
            _ => requestedDamage
        };

        var temporaryConsumed = Math.Min(Temporary, adjustedDamage);
        var remainingDamage = adjustedDamage - temporaryConsumed;
        var hitPointsConsumed = Math.Min(Current, remainingDamage);

        var next = new HitPointPool(
            Current - hitPointsConsumed,
            Maximum,
            Temporary - temporaryConsumed);

        return new DamageResolution(
            next,
            requestedDamage,
            adjustedDamage,
            temporaryConsumed,
            hitPointsConsumed,
            defense);
    }

    public HealingResolution Heal(int requestedHealing)
    {
        if (requestedHealing <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(requestedHealing), "Healing must be greater than zero.");
        }

        var appliedHealing = Math.Min(requestedHealing, Maximum - Current);
        var next = new HitPointPool(Current + appliedHealing, Maximum, Temporary);
        return new HealingResolution(next, requestedHealing, appliedHealing);
    }

    public TemporaryHitPointResolution SetTemporaryHitPoints(int requestedTemporaryHitPoints)
    {
        if (requestedTemporaryHitPoints < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(requestedTemporaryHitPoints),
                "Temporary HP cannot be negative.");
        }

        // A request of exactly zero is never a meaningful "grant" under the
        // higher-value-wins rule below (max(current, 0) is always a no-op
        // once current > 0), so it is treated as an explicit, unconditional
        // clear instead. Any positive request still only replaces a lower
        // existing value.
        var appliedTemporaryHitPoints = requestedTemporaryHitPoints == 0
            ? 0
            : Math.Max(Temporary, requestedTemporaryHitPoints);
        var next = new HitPointPool(Current, Maximum, appliedTemporaryHitPoints);
        return new TemporaryHitPointResolution(
            next,
            requestedTemporaryHitPoints,
            appliedTemporaryHitPoints);
    }
}

public sealed record DamageResolution(
    HitPointPool Next,
    int RequestedDamage,
    int AdjustedDamage,
    int TemporaryHitPointsConsumed,
    int HitPointsConsumed,
    DefenseKind Defense);

public sealed record HealingResolution(
    HitPointPool Next,
    int RequestedHealing,
    int AppliedHealing);

public sealed record TemporaryHitPointResolution(
    HitPointPool Next,
    int RequestedTemporaryHitPoints,
    int AppliedTemporaryHitPoints);
