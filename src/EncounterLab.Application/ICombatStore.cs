using EncounterLab.Domain.Combat;

namespace EncounterLab.Application;

public interface ICombatStore
{
    Task<EncounterSnapshot> GetEncounterAsync(string characterId, CancellationToken cancellationToken);

    Task<CombatResult> ExecuteAsync(
        string characterId,
        string commandId,
        string requestFingerprint,
        int expectedVersion,
        Func<CharacterState, CombatDecision> decide,
        CancellationToken cancellationToken);

    Task<CombatResult> ResetAsync(
        string characterId,
        string commandId,
        string requestFingerprint,
        int expectedVersion,
        CancellationToken cancellationToken);
}
