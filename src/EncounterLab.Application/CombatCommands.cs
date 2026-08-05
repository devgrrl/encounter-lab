using EncounterLab.Domain.Combat;

namespace EncounterLab.Application;

public abstract record CombatCommand(string CharacterId, string CommandId, int ExpectedVersion);

public sealed record DamageCommand(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount,
    DamageType DamageType) : CombatCommand(CharacterId, CommandId, ExpectedVersion);

public sealed record HealCommand(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount) : CombatCommand(CharacterId, CommandId, ExpectedVersion);

public sealed record SetTemporaryHitPointsCommand(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    int Amount) : CombatCommand(CharacterId, CommandId, ExpectedVersion);

public sealed record DiceRollCommand(
    string CharacterId,
    string CommandId,
    int ExpectedVersion,
    string Expression) : CombatCommand(CharacterId, CommandId, ExpectedVersion);

public sealed record ResetEncounterCommand(
    string CharacterId,
    string CommandId,
    int ExpectedVersion) : CombatCommand(CharacterId, CommandId, ExpectedVersion);
