using EncounterLab.Domain.Combat;

namespace EncounterLab.Domain.Tests;

public sealed class DiceExpressionTests
{
    [Theory]
    [InlineData("d20", 1, 20, 0, 0, 0)]
    [InlineData("2d6+3", 2, 6, 0, 0, 3)]
    [InlineData("d100-10", 1, 100, 0, 0, -10)]
    [InlineData("d8+d6+4", 1, 8, 1, 6, 4)]
    [InlineData("2d6+1d4-2", 2, 6, 1, 4, -2)]
    [InlineData("d2", 1, 2, 0, 0, 0)]
    [InlineData("1d20+2d2", 1, 20, 2, 2, 0)]
    public void ParsesSupportedExpressions(
        string input,
        int count,
        int sides,
        int secondaryCount,
        int secondarySides,
        int modifier)
    {
        var value = DiceExpression.Parse(input);
        Assert.Equal(count, value.Count);
        Assert.Equal(sides, value.Sides);
        Assert.Equal(secondaryCount, value.SecondaryCount);
        Assert.Equal(secondarySides, value.SecondarySides);
        Assert.Equal(modifier, value.Modifier);
    }

    [Theory]
    [InlineData("")]
    [InlineData("100d20")]
    [InlineData("2d7")]
    [InlineData("d1")]
    [InlineData("roll d20")]
    [InlineData("d20+2147483648")]
    [InlineData("d20+10001")]
    [InlineData("d6+d8+d10")]
    [InlineData("15d6+15d4")]
    [InlineData("0d20")]
    public void RejectsUnsupportedExpressions(string input)
    {
        Assert.Throws<FormatException>(() => DiceExpression.Parse(input));
    }

    [Theory]
    [InlineData("2d6+3", "2d6+3")]
    [InlineData("d100-10", "1d100-10")]
    [InlineData("d20", "1d20")]
    [InlineData("d8+d6+4", "1d8+1d6+4")]
    public void FormatsBackToACanonicalExpressionString(string input, string expected)
    {
        Assert.Equal(expected, DiceExpression.Parse(input).ToString());
    }
}
