namespace EncounterLab.Domain.Combat;

public sealed record UncommittedCombatEvent(
    string Id,
    string Type,
    string Summary,
    CombatEventDetails Details,
    CharacterStateProjection StateAfter)
{
    public static UncommittedCombatEvent Create(
        string type,
        string summary,
        CombatEventDetails details,
        CharacterState state) =>
        new(
            Guid.NewGuid().ToString("N"),
            type,
            summary,
            details,
            state.ToProjection());
}
