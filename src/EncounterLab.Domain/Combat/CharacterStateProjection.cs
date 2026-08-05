namespace EncounterLab.Domain.Combat;

public sealed record CharacterStateProjection(
    int CurrentHitPoints,
    int MaximumHitPoints,
    int TemporaryHitPoints,
    int Version);
