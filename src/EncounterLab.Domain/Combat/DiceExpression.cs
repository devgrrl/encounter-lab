using System.Globalization;
using System.Text.RegularExpressions;

namespace EncounterLab.Domain.Combat;

public sealed record DiceTerm(int Count, int Sides)
{
    public override string ToString() => $"{Count}d{Sides}";
}

public sealed partial record DiceExpression
{
    public const int MaximumDice = 20;
    public const int MaximumTerms = 2;
    public const int MaximumAbsoluteModifier = 10_000;
    private static readonly HashSet<int> AllowedSides = [4, 6, 8, 10, 12, 20, 100];

    private DiceExpression(IReadOnlyList<DiceTerm> terms, int modifier)
    {
        Terms = terms;
        Modifier = modifier;
    }

    public IReadOnlyList<DiceTerm> Terms { get; }
    public int Modifier { get; }

    // Compatibility aliases for the original single-term API.
    public int Count => Terms[0].Count;
    public int Sides => Terms[0].Sides;
    public int SecondaryCount => Terms.Count > 1 ? Terms[1].Count : 0;
    public int SecondarySides => Terms.Count > 1 ? Terms[1].Sides : 0;

    public static DiceExpression Parse(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new FormatException("A dice expression is required.");
        }

        var normalized = value.Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
        var match = DiceRegex().Match(normalized);
        if (!match.Success)
        {
            throw new FormatException("Use one or two dice groups, such as d20, 2d6+3, or d8+d6+4.");
        }

        var terms = new List<DiceTerm>(MaximumTerms)
        {
            ParseTerm(match.Groups["count1"].Value, match.Groups["sides1"].Value)
        };

        if (match.Groups["sides2"].Success)
        {
            terms.Add(ParseTerm(match.Groups["count2"].Value, match.Groups["sides2"].Value));
        }

        if (terms.Sum(term => term.Count) > MaximumDice)
        {
            throw new FormatException($"Roll no more than {MaximumDice} dice across both groups.");
        }

        var modifier = match.Groups["modifier"].Success
            ? ParseInteger(match.Groups["modifier"].Value, "modifier")
            : 0;

        if (modifier is < -MaximumAbsoluteModifier or > MaximumAbsoluteModifier)
        {
            throw new FormatException($"Modifiers must be between -{MaximumAbsoluteModifier} and {MaximumAbsoluteModifier}.");
        }

        return new DiceExpression(terms, modifier);
    }

    public override string ToString()
    {
        var modifier = Modifier switch
        {
            > 0 => $"+{Modifier}",
            < 0 => Modifier.ToString(CultureInfo.InvariantCulture),
            _ => string.Empty
        };
        return $"{string.Join("+", Terms)}{modifier}";
    }

    private static DiceTerm ParseTerm(string countText, string sidesText)
    {
        var count = string.IsNullOrEmpty(countText)
            ? 1
            : ParseInteger(countText, "dice count");
        var sides = ParseInteger(sidesText, "die size");

        if (count is < 1 or > MaximumDice)
        {
            throw new FormatException($"Each group must roll between 1 and {MaximumDice} dice.");
        }

        if (!AllowedSides.Contains(sides))
        {
            throw new FormatException("Allowed dice are d4, d6, d8, d10, d12, d20, and d100.");
        }

        return new DiceTerm(count, sides);
    }

    private static int ParseInteger(string value, string label)
    {
        if (!int.TryParse(value, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var parsed))
        {
            throw new FormatException($"The {label} is outside the supported range.");
        }
        return parsed;
    }

    [GeneratedRegex("""^(?<count1>\d{0,2})d(?<sides1>\d{1,3})(?:\+(?<count2>\d{0,2})d(?<sides2>\d{1,3}))?(?<modifier>[+-]\d+)?$""", RegexOptions.CultureInvariant)]
    private static partial Regex DiceRegex();
}
