namespace EncounterLab.Domain.Combat;

public sealed record CharacterItem(
    string Name,
    CharacterModifier Modifier);

public sealed record CharacterModifier(
    string AffectedObject,
    string AffectedValue,
    int Value);
