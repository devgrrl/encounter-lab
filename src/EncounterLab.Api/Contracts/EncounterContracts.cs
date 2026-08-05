using EncounterLab.Application;
using EncounterLab.Domain.Combat;

namespace EncounterLab.Api.Contracts;

public sealed record EncounterPayload(
    CharacterPayload Character,
    IReadOnlyList<CombatEventPayload> Events,
    bool HistoryTruncated)
{
    public static EncounterPayload From(EncounterSnapshot snapshot) =>
        new(
            CharacterPayload.From(snapshot.Character),
            snapshot.Events.Select(CombatEventPayload.From).ToArray(),
            snapshot.HistoryTruncated);
}

public sealed record CombatResultPayload(
    CharacterPayload Character,
    CombatEventPayload Event,
    bool WasReplay)
{
    public static CombatResultPayload From(CombatResult result) =>
        new(
            CharacterPayload.From(result.Character),
            CombatEventPayload.From(result.Event),
            result.WasReplay);
}

public sealed record CharacterPayload(
    string Id,
    string Name,
    int Level,
    IReadOnlyList<CharacterClassPayload> Classes,
    AbilityScoresPayload Stats,
    IReadOnlyList<CharacterItemPayload> Items,
    HitPointPayload HitPoints,
    IReadOnlyList<DefensePayload> Defenses,
    int Version)
{
    public static CharacterPayload From(CharacterState state) =>
        new(
            state.Id,
            state.Name,
            state.Level,
            state.Classes.Select(item => new CharacterClassPayload(
                item.Name,
                item.HitDiceValue,
                item.ClassLevel)).ToArray(),
            new AbilityScoresPayload(
                state.Stats.Strength,
                state.Stats.Dexterity,
                state.Stats.Constitution,
                state.Stats.Intelligence,
                state.Stats.Wisdom,
                state.Stats.Charisma),
            state.Items.Select(item => new CharacterItemPayload(
                item.Name,
                new CharacterModifierPayload(
                    item.Modifier.AffectedObject,
                    item.Modifier.AffectedValue,
                    item.Modifier.Value))).ToArray(),
            new HitPointPayload(
                state.HitPoints.Current,
                state.HitPoints.Maximum,
                state.HitPoints.Temporary),
            state.Defenses
                .OrderBy(item => item.Key)
                .Select(item => new DefensePayload(item.Key, item.Value))
                .ToArray(),
            state.Version);
}

public sealed record CharacterClassPayload(string Name, int HitDiceValue, int ClassLevel);

public sealed record CharacterItemPayload(string Name, CharacterModifierPayload Modifier);

public sealed record CharacterModifierPayload(
    string AffectedObject,
    string AffectedValue,
    int Value);

public sealed record AbilityScoresPayload(
    int Strength,
    int Dexterity,
    int Constitution,
    int Intelligence,
    int Wisdom,
    int Charisma);

public sealed record HitPointPayload(int Current, int Maximum, int Temporary);

public sealed record DefensePayload(DamageType DamageType, DefenseKind Kind);

public sealed record CombatEventPayload(
    string Id,
    long Sequence,
    DateTimeOffset OccurredAt,
    string CommandId,
    string CharacterId,
    string Type,
    string Summary,
    CombatEventDetails Details,
    CharacterStateProjection StateAfter)
{
    public static CombatEventPayload From(CombatEventEnvelope value) =>
        new(
            value.Id,
            value.Sequence,
            value.OccurredAt,
            value.CommandId,
            value.CharacterId,
            value.Type,
            value.Summary,
            value.Details,
            value.StateAfter);
}

public sealed record DamageInput(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount,
    DamageType DamageType);

public sealed record HealInput(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount);

public sealed record TemporaryHitPointsInput(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount);

public sealed record DiceRollInput(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    string Expression);

public sealed record ResetEncounterInput(
    string CharacterId,
    string CommandId,
    int ExpectedVersion);
