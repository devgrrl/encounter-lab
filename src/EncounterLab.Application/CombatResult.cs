using EncounterLab.Domain.Combat;

namespace EncounterLab.Application;

public sealed record CombatResult(
    CharacterState Character,
    CombatEventEnvelope Event,
    bool WasReplay);

public sealed record EncounterSnapshot(
    CharacterState Character,
    IReadOnlyList<CombatEventEnvelope> Events,
    bool HistoryTruncated = false);
