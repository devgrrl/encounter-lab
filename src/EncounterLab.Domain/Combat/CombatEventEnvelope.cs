namespace EncounterLab.Domain.Combat;

public sealed record CombatEventEnvelope(
    string Id,
    long Sequence,
    DateTimeOffset OccurredAt,
    string CommandId,
    string CharacterId,
    string Type,
    string Summary,
    CombatEventDetails Details,
    CharacterStateProjection StateAfter);
