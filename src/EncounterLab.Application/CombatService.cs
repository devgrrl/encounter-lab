using EncounterLab.Domain.Combat;

namespace EncounterLab.Application;

public sealed class CombatService(
    ICombatStore store,
    ICombatNotifier notifier,
    IRandomSource randomSource)
{
    private const int MaximumCharacterIdLength = 64;

    public Task<EncounterSnapshot> GetEncounterAsync(
        string characterId,
        CancellationToken cancellationToken) =>
        store.GetEncounterAsync(RequireCharacterId(characterId), cancellationToken);

    public Task<CombatResult> ApplyDamageAsync(
        DamageCommand command,
        CancellationToken cancellationToken) =>
        ExecuteAndNotifyAsync(
            Normalize(command),
            state => state.ApplyDamage(
                RequirePositive(command.Amount, nameof(command.Amount)),
                command.DamageType),
            cancellationToken);

    public Task<CombatResult> HealAsync(
        HealCommand command,
        CancellationToken cancellationToken) =>
        ExecuteAndNotifyAsync(
            Normalize(command),
            state => state.Heal(RequirePositive(command.Amount, nameof(command.Amount))),
            cancellationToken);

    public Task<CombatResult> SetTemporaryHitPointsAsync(
        SetTemporaryHitPointsCommand command,
        CancellationToken cancellationToken) =>
        ExecuteAndNotifyAsync(
            Normalize(command),
            state => state.SetTemporaryHitPoints(RequireNonNegative(command.Amount, nameof(command.Amount))),
            cancellationToken);

    public Task<CombatResult> RollDiceAsync(
        DiceRollCommand command,
        CancellationToken cancellationToken)
    {
        var normalized = Normalize(command);
        var expression = ParseDice(normalized.Expression);

        return ExecuteAndNotifyAsync(
            normalized,
            state =>
            {
                var groups = expression.Terms
                    .Select(term => Enumerable.Range(0, term.Count)
                        .Select(_ => randomSource.Next(1, term.Sides + 1))
                        .ToArray())
                    .ToArray();
                var dice = groups.SelectMany(value => value).ToArray();
                var groupResults = groups
                    .Select((rolls, index) => new DiceGroupResult(
                        expression.Terms[index].ToString(),
                        rolls,
                        checked(rolls.Sum())))
                    .ToArray();
                var total = checked(groupResults.Sum(group => group.Total) + expression.Modifier);
                return state.RecordDiceRoll(expression, dice, groupResults, total);
            },
            cancellationToken);
    }

    public async Task<CombatResult> ResetEncounterAsync(
        ResetEncounterCommand command,
        CancellationToken cancellationToken)
    {
        var normalized = Normalize(command);
        var result = await store.ResetAsync(
            normalized.CharacterId,
            normalized.CommandId,
            CreateFingerprint(normalized),
            normalized.ExpectedVersion,
            cancellationToken);
        await QueueNotificationWhenCommittedAsync(result);
        return result;
    }

    private async Task<CombatResult> ExecuteAndNotifyAsync(
        CombatCommand command,
        Func<CharacterState, CombatDecision> decide,
        CancellationToken cancellationToken)
    {
        var result = await store.ExecuteAsync(
            command.CharacterId,
            command.CommandId,
            CreateFingerprint(command),
            command.ExpectedVersion,
            decide,
            cancellationToken);
        await QueueNotificationWhenCommittedAsync(result);
        return result;
    }

    private Task QueueNotificationWhenCommittedAsync(CombatResult result) =>
        result.WasReplay
            ? Task.CompletedTask
            : notifier.PublishCommittedAsync(result, CancellationToken.None);

    private static DamageCommand Normalize(DamageCommand command) => command with
    {
        CharacterId = RequireCharacterId(command.CharacterId),
        CommandId = RequireCommandId(command.CommandId),
        ExpectedVersion = RequireExpectedVersion(command.ExpectedVersion)
    };

    private static HealCommand Normalize(HealCommand command) => command with
    {
        CharacterId = RequireCharacterId(command.CharacterId),
        CommandId = RequireCommandId(command.CommandId),
        ExpectedVersion = RequireExpectedVersion(command.ExpectedVersion)
    };

    private static SetTemporaryHitPointsCommand Normalize(SetTemporaryHitPointsCommand command) => command with
    {
        CharacterId = RequireCharacterId(command.CharacterId),
        CommandId = RequireCommandId(command.CommandId),
        ExpectedVersion = RequireExpectedVersion(command.ExpectedVersion)
    };

    private static DiceRollCommand Normalize(DiceRollCommand command) => command with
    {
        CharacterId = RequireCharacterId(command.CharacterId),
        CommandId = RequireCommandId(command.CommandId),
        ExpectedVersion = RequireExpectedVersion(command.ExpectedVersion),
        Expression = RequireDiceExpression(command.Expression)
    };

    private static ResetEncounterCommand Normalize(ResetEncounterCommand command) => command with
    {
        CharacterId = RequireCharacterId(command.CharacterId),
        CommandId = RequireCommandId(command.CommandId),
        ExpectedVersion = RequireExpectedVersion(command.ExpectedVersion)
    };

    private static string CreateFingerprint(CombatCommand command) => command switch
    {
        DamageCommand value => $"damage|{value.CharacterId}|{value.ExpectedVersion}|{value.Amount}|{value.DamageType}",
        HealCommand value => $"heal|{value.CharacterId}|{value.ExpectedVersion}|{value.Amount}",
        SetTemporaryHitPointsCommand value => $"temporary|{value.CharacterId}|{value.ExpectedVersion}|{value.Amount}",
        DiceRollCommand value => $"dice|{value.CharacterId}|{value.ExpectedVersion}|{value.Expression.ToLowerInvariant()}",
        ResetEncounterCommand value => $"reset|{value.CharacterId}|{value.ExpectedVersion}",
        _ => throw new CombatValidationException("Unsupported command type.")
    };

    private static string RequireCharacterId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new CombatValidationException("A character ID is required.");
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > MaximumCharacterIdLength)
        {
            throw new CombatValidationException(
                $"Character IDs cannot exceed {MaximumCharacterIdLength} characters.");
        }
        return normalized;
    }

    private static string RequireCommandId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new CombatValidationException("A command ID is required.");
        }

        var normalized = value.Trim();
        if (normalized.Length > 128)
        {
            throw new CombatValidationException("Command IDs cannot exceed 128 characters.");
        }
        return normalized;
    }

    private static int RequireExpectedVersion(int value)
    {
        if (value < 0)
        {
            throw new CombatValidationException("Expected version cannot be negative.");
        }
        return value;
    }

    private static string RequireDiceExpression(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new CombatValidationException("A dice expression is required.");
        }

        var normalized = value.Trim();
        if (normalized.Length > 64)
        {
            throw new CombatValidationException("Dice expressions cannot exceed 64 characters.");
        }
        return normalized;
    }

    private static int RequirePositive(int value, string name)
    {
        if (value <= 0)
        {
            throw new CombatValidationException($"{name} must be greater than zero.");
        }
        return value;
    }

    private static int RequireNonNegative(int value, string name)
    {
        if (value < 0)
        {
            throw new CombatValidationException($"{name} cannot be negative.");
        }
        return value;
    }

    private static DiceExpression ParseDice(string value)
    {
        try
        {
            return DiceExpression.Parse(value);
        }
        catch (FormatException exception)
        {
            throw new CombatValidationException(exception.Message);
        }
    }
}
