using EncounterLab.Infrastructure;

namespace EncounterLab.Api.Tests;

public sealed class FileCharacterSeedTests
{
    private static string WriteBrivJson(object payload)
    {
        var path = Path.Combine(Path.GetTempPath(), $"briv-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, System.Text.Json.JsonSerializer.Serialize(payload));
        return path;
    }

    private static object BaseCharacter(object modifier) => new
    {
        name = "Briv",
        level = 5,
        hitPoints = 25,
        classes = new[] { new { name = "fighter", hitDiceValue = 10, classLevel = 5 } },
        stats = new { strength = 15, dexterity = 12, constitution = 14, intelligence = 13, wisdom = 10, charisma = 8 },
        items = new[] { new { name = "Test Item", modifier } },
        defenses = Array.Empty<object>(),
    };

    [Theory]
    [InlineData("strength", 17)]
    [InlineData("dexterity", 14)]
    [InlineData("intelligence", 15)]
    [InlineData("wisdom", 12)]
    [InlineData("charisma", 10)]
    public void EachSupportedAbilityScoreModifierIsApplied(string stat, int expected)
    {
        var path = WriteBrivJson(BaseCharacter(new { affectedObject = "stats", affectedValue = stat, value = 2 }));
        try
        {
            var character = new FileCharacterSeed(path).Create();
            var actual = stat switch
            {
                "strength" => character.Stats.Strength,
                "dexterity" => character.Stats.Dexterity,
                "intelligence" => character.Stats.Intelligence,
                "wisdom" => character.Stats.Wisdom,
                "charisma" => character.Stats.Charisma,
                _ => throw new InvalidOperationException(),
            };
            Assert.Equal(expected, actual);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void AnItemTargetingAnUnsupportedObjectFailsToLoad()
    {
        var path = WriteBrivJson(BaseCharacter(new { affectedObject = "equipment", affectedValue = "strength", value = 1 }));
        try
        {
            Assert.Throws<InvalidDataException>(() => new FileCharacterSeed(path).Create());
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void AnItemTargetingAnUnsupportedStatFailsToLoad()
    {
        var path = WriteBrivJson(BaseCharacter(new { affectedObject = "stats", affectedValue = "luck", value = 1 }));
        try
        {
            Assert.Throws<InvalidDataException>(() => new FileCharacterSeed(path).Create());
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void AMissingSeedFileFailsToLoad()
    {
        var path = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.json");
        Assert.Throws<FileNotFoundException>(() => new FileCharacterSeed(path).Create());
    }

    [Fact]
    public void AnEmptySeedFileFailsToDeserialize()
    {
        var path = Path.Combine(Path.GetTempPath(), $"empty-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, "null");
        try
        {
            Assert.Throws<InvalidDataException>(() => new FileCharacterSeed(path).Create());
        }
        finally
        {
            File.Delete(path);
        }
    }
}
