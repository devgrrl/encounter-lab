using EncounterLab.Domain.Combat;

namespace EncounterLab.Domain.Tests;

public sealed class CharacterStateTests
{
    [Fact]
    public void FireDefenseIsAppliedFromCharacterConfiguration()
    {
        var character = Create();
        var decision = character.ApplyDamage(8, DamageType.Fire);
        Assert.Equal(25, decision.State.HitPoints.Current);
        Assert.Equal(DefenseKind.Immunity, decision.Event.Details.Defense);
        Assert.Equal(1, decision.State.Version);
    }

    [Fact]
    public void SlashingResistanceAndTemporaryHitPointsComposeCorrectly()
    {
        var character = Create() with { HitPoints = new HitPointPool(11, 25, 10) };
        var decision = character.ApplyDamage(19, DamageType.Slashing);
        Assert.Equal(11, decision.State.HitPoints.Current);
        Assert.Equal(1, decision.State.HitPoints.Temporary);
        Assert.Equal(9, decision.Event.Details.AdjustedDamage);
    }


    [Fact]
    public void HealingRestoresHitPointsAndReportsTheAppliedAmount()
    {
        var character = Create() with { HitPoints = new HitPointPool(11, 25) };
        var decision = character.Heal(20);
        Assert.Equal(25, decision.State.HitPoints.Current);
        Assert.Equal(14, decision.Event.Details.AppliedHealing);
        Assert.Contains("healed", decision.Event.Summary, StringComparison.Ordinal);
        Assert.Equal(1, decision.State.Version);
    }

    [Fact]
    public void HealingAtMaximumHitPointsReportsNoChange()
    {
        var character = Create();
        var decision = character.Heal(5);
        Assert.Equal(25, decision.State.HitPoints.Current);
        Assert.Equal(0, decision.Event.Details.AppliedHealing);
        Assert.Contains("already at maximum", decision.Event.Summary, StringComparison.Ordinal);
    }

    [Fact]
    public void EqualTemporaryHitPointsAreKeptWithAccurateSummary()
    {
        var character = Create() with { HitPoints = new HitPointPool(25, 25, 10) };
        var decision = character.SetTemporaryHitPoints(10);
        Assert.Equal(10, decision.State.HitPoints.Temporary);
        Assert.Contains("equal or higher", decision.Event.Summary, StringComparison.Ordinal);
    }

    [Fact]
    public void SettingTemporaryHitPointsToZeroClearsThemWithAnAccurateSummary()
    {
        var character = Create() with { HitPoints = new HitPointPool(25, 25, 10) };
        var decision = character.SetTemporaryHitPoints(0);
        Assert.Equal(0, decision.State.HitPoints.Temporary);
        Assert.Contains("cleared", decision.Event.Summary, StringComparison.Ordinal);
    }

    private static CharacterState Create() =>
        new(
            "briv",
            "Briv",
            5,
            [new CharacterClass("fighter", 10, 5)],
            new AbilityScores(15, 12, 14, 13, 10, 8),
            new HitPointPool(25, 25),
            new Dictionary<DamageType, DefenseKind>
            {
                [DamageType.Fire] = DefenseKind.Immunity,
                [DamageType.Slashing] = DefenseKind.Resistance
            },
            0);
}
