namespace EncounterLab.Application;

public sealed class CombatValidationException(string message) : Exception(message);

public sealed class CombatConflictException(int expected, int actual)
    : Exception($"Expected version {expected}, but the current version is {actual}.")
{
    public int Expected { get; } = expected;
    public int Actual { get; } = actual;
}

public sealed class IdempotencyConflictException(string commandId)
    : Exception($"Command ID '{commandId}' was already used for a different request.");

public sealed class CharacterNotFoundException(string characterId)
    : Exception($"Character '{characterId}' was not found.");
