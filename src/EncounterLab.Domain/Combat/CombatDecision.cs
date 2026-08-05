namespace EncounterLab.Domain.Combat;

public sealed record CombatDecision(CharacterState State, UncommittedCombatEvent Event);
