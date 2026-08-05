using EncounterLab.Domain.Combat;

namespace EncounterLab.Domain.Tests;

public sealed class HitPointPoolTests
{
    [Fact]
    public void NormalDamageReducesCurrentHitPoints()
    {
        var result = new HitPointPool(25, 25).ApplyDamage(14, DefenseKind.None);
        Assert.Equal(11, result.Next.Current);
        Assert.Equal(14, result.HitPointsConsumed);
    }

    [Fact]
    public void ImmunityPreventsAllDamage()
    {
        var result = new HitPointPool(25, 25).ApplyDamage(99, DefenseKind.Immunity);
        Assert.Equal(25, result.Next.Current);
        Assert.Equal(0, result.AdjustedDamage);
    }

    [Theory]
    [InlineData(14, 7)]
    [InlineData(19, 9)]
    public void ResistanceHalvesAndRoundsDown(int requested, int expected)
    {
        var result = new HitPointPool(25, 25).ApplyDamage(requested, DefenseKind.Resistance);
        Assert.Equal(expected, result.AdjustedDamage);
    }

    [Fact]
    public void TemporaryHitPointsAbsorbDamageBeforeCurrentHitPoints()
    {
        var result = new HitPointPool(11, 25, 10).ApplyDamage(19, DefenseKind.None);
        Assert.Equal(2, result.Next.Current);
        Assert.Equal(0, result.Next.Temporary);
        Assert.Equal(10, result.TemporaryHitPointsConsumed);
        Assert.Equal(9, result.HitPointsConsumed);
    }

    [Fact]
    public void DamageCannotReduceCurrentHitPointsBelowZero()
    {
        var result = new HitPointPool(3, 25, 2).ApplyDamage(100, DefenseKind.None);
        Assert.Equal(0, result.Next.Current);
        Assert.Equal(0, result.Next.Temporary);
    }

    [Fact]
    public void HealingCapsAtMaximumAndDoesNotChangeTemporaryHitPoints()
    {
        var result = new HitPointPool(22, 25, 8).Heal(20);
        Assert.Equal(25, result.Next.Current);
        Assert.Equal(8, result.Next.Temporary);
        Assert.Equal(3, result.AppliedHealing);
    }

    [Fact]
    public void LowerTemporaryHitPointValueIsIgnored()
    {
        var result = new HitPointPool(25, 25, 10).SetTemporaryHitPoints(4);
        Assert.Equal(10, result.Next.Temporary);
    }

    [Fact]
    public void HigherTemporaryHitPointValueReplacesLowerValue()
    {
        var result = new HitPointPool(25, 25, 4).SetTemporaryHitPoints(10);
        Assert.Equal(10, result.Next.Temporary);
    }

    [Fact]
    public void RequestingZeroTemporaryHitPointsClearsUnconditionally()
    {
        var result = new HitPointPool(25, 25, 10).SetTemporaryHitPoints(0);
        Assert.Equal(0, result.Next.Temporary);
        Assert.Equal(0, result.AppliedTemporaryHitPoints);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void DamageMustBePositive(int amount)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new HitPointPool(25, 25).ApplyDamage(amount, DefenseKind.None));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void MaximumHitPointsMustBePositive(int maximum)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new HitPointPool(0, maximum));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(26)]
    public void CurrentHitPointsMustBeWithinBounds(int current)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new HitPointPool(current, 25));
    }

    [Fact]
    public void TemporaryHitPointsMustNotBeNegativeInTheConstructor()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new HitPointPool(25, 25, -1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void HealingMustBePositive(int amount)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new HitPointPool(20, 25).Heal(amount));
    }

    [Fact]
    public void TemporaryHitPointsMustNotBeNegativeWhenSet()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new HitPointPool(25, 25).SetTemporaryHitPoints(-1));
    }

    [Fact]
    public void ResolutionsReportTheOriginallyRequestedAmounts()
    {
        var damage = new HitPointPool(25, 25).ApplyDamage(14, DefenseKind.None);
        Assert.Equal(14, damage.RequestedDamage);

        var healing = new HitPointPool(11, 25).Heal(5);
        Assert.Equal(5, healing.RequestedHealing);

        var temporary = new HitPointPool(25, 25).SetTemporaryHitPoints(6);
        Assert.Equal(6, temporary.RequestedTemporaryHitPoints);
    }
}
