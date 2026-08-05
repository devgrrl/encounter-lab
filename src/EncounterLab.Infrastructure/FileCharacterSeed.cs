using System.Text.Json;
using EncounterLab.Domain.Combat;
using EncounterLab.Domain.Serialization;

namespace EncounterLab.Infrastructure;

public sealed class FileCharacterSeed(string filePath) : ICharacterSeed
{
    private readonly Lazy<BrivFileModel> model = new(() => Load(filePath));

    public CharacterState Create(int version = 0)
    {
        var source = model.Value;
        var defenses = source.Defenses.ToDictionary(
            item => Enum.Parse<DamageType>(item.Type, ignoreCase: true),
            item => Enum.Parse<DefenseKind>(item.Defense, ignoreCase: true));
        var items = source.Items
            .Select(item => new CharacterItem(
                item.Name,
                new CharacterModifier(
                    item.Modifier.AffectedObject,
                    item.Modifier.AffectedValue,
                    item.Modifier.Value)))
            .ToArray();
        var stats = ApplyItemModifiers(source.Stats, source.Items);

        return new CharacterState(
            Path.GetFileNameWithoutExtension(filePath).ToLowerInvariant(),
            source.Name,
            source.Level,
            source.Classes
                .Select(item => new CharacterClass(item.Name, item.HitDiceValue, item.ClassLevel))
                .ToArray(),
            stats,
            new HitPointPool(source.HitPoints, source.HitPoints),
            defenses,
            version)
        {
            Items = items
        };
    }

    private static AbilityScores ApplyItemModifiers(
        StatsFileModel source,
        IReadOnlyList<ItemFileModel> items)
    {
        var scores = new AbilityScores(
            source.Strength,
            source.Dexterity,
            source.Constitution,
            source.Intelligence,
            source.Wisdom,
            source.Charisma);

        foreach (var item in items)
        {
            var modifier = item.Modifier;
            if (!string.Equals(modifier.AffectedObject, "stats", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException(
                    $"Item '{item.Name}' targets unsupported object '{modifier.AffectedObject}'.");
            }

            scores = modifier.AffectedValue.Trim().ToLowerInvariant() switch
            {
                "strength" => scores with { Strength = checked(scores.Strength + modifier.Value) },
                "dexterity" => scores with { Dexterity = checked(scores.Dexterity + modifier.Value) },
                "constitution" => scores with { Constitution = checked(scores.Constitution + modifier.Value) },
                "intelligence" => scores with { Intelligence = checked(scores.Intelligence + modifier.Value) },
                "wisdom" => scores with { Wisdom = checked(scores.Wisdom + modifier.Value) },
                "charisma" => scores with { Charisma = checked(scores.Charisma + modifier.Value) },
                _ => throw new InvalidDataException(
                    $"Item '{item.Name}' targets unsupported stat '{modifier.AffectedValue}'.")
            };
        }

        return scores;
    }

    private static BrivFileModel Load(string filePath)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("The challenge-provided briv.json file was not found.", filePath);
        }

        var value = JsonSerializer.Deserialize<BrivFileModel>(
            File.ReadAllText(filePath),
            JsonDefaults.Options);
        return value ?? throw new InvalidDataException("briv.json could not be deserialized.");
    }

    private sealed record BrivFileModel(
        string Name,
        int Level,
        int HitPoints,
        IReadOnlyList<ClassFileModel> Classes,
        StatsFileModel Stats,
        IReadOnlyList<ItemFileModel> Items,
        IReadOnlyList<DefenseFileModel> Defenses);

    private sealed record ClassFileModel(string Name, int HitDiceValue, int ClassLevel);

    private sealed record StatsFileModel(
        int Strength,
        int Dexterity,
        int Constitution,
        int Intelligence,
        int Wisdom,
        int Charisma);

    private sealed record ItemFileModel(string Name, ModifierFileModel Modifier);

    private sealed record ModifierFileModel(
        string AffectedObject,
        string AffectedValue,
        int Value);

    private sealed record DefenseFileModel(string Type, string Defense);
}
