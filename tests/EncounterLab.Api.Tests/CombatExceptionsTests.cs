using EncounterLab.Application;

namespace EncounterLab.Api.Tests;

public sealed class CombatExceptionsTests
{
    [Fact]
    public void CharacterNotFoundExceptionNamesTheMissingCharacter()
    {
        var exception = new CharacterNotFoundException("nobody");
        Assert.Contains("nobody", exception.Message, StringComparison.Ordinal);
    }
}
