using System.Data;
using System.Text.Json;
using EncounterLab.Application;
using EncounterLab.Domain.Combat;
using EncounterLab.Domain.Serialization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EncounterLab.Infrastructure;

public sealed class SqliteCombatStore(
    IDbContextFactory<EncounterDbContext> contextFactory,
    ICharacterSeed characterSeed) : ICombatStore
{
    public const int SnapshotEventLimit = 250;
    public const int RetainedEventLimit = 1_000;
    public static readonly TimeSpan ProcessedCommandRetention = TimeSpan.FromDays(7);

    public async Task<EncounterSnapshot> GetEncounterAsync(
        string characterId,
        CancellationToken cancellationToken)
    {
        await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
        await using var transaction = await context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var snapshot = await context.CharacterSnapshots
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == characterId, cancellationToken)
            ?? throw new CharacterNotFoundException(characterId);

        var eventRows = await context.CombatEvents
            .AsNoTracking()
            .Where(item => item.CharacterId == characterId)
            .OrderByDescending(item => item.Sequence)
            .Take(SnapshotEventLimit + 1)
            .Select(item => new { item.Sequence, item.Json })
            .ToListAsync(cancellationToken);
        var historyTruncated = eventRows.Count > SnapshotEventLimit;
        if (historyTruncated)
        {
            eventRows.RemoveAt(eventRows.Count - 1);
        }
        eventRows.Reverse();
        historyTruncated = historyTruncated
            || (eventRows.Count > 0 && eventRows[0].Sequence > 1);

        var character = Deserialize<CharacterState>(snapshot.Json);
        if (character.Version != snapshot.Version)
        {
            throw new InvalidDataException(
                $"Stored character version {character.Version} did not match snapshot version {snapshot.Version}.");
        }

        var result = new EncounterSnapshot(
            character,
            eventRows.Select(item => Deserialize<CombatEventEnvelope>(item.Json)).ToArray(),
            historyTruncated);

        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<CombatResult> ExecuteAsync(
        string characterId,
        string commandId,
        string requestFingerprint,
        int expectedVersion,
        Func<CharacterState, CombatDecision> decide,
        CancellationToken cancellationToken)
    {
        await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
        await context.Database.OpenConnectionAsync(cancellationToken);
        var connection = (SqliteConnection)context.Database.GetDbConnection();
        await using var transaction = connection.BeginTransaction(
            IsolationLevel.Serializable,
            deferred: false);
        await context.Database.UseTransactionAsync(transaction, cancellationToken);

        var previous = await context.ProcessedCommands
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.CharacterId == characterId && item.CommandId == commandId,
                cancellationToken);
        if (previous is not null)
        {
            if (!string.Equals(previous.RequestFingerprint, requestFingerprint, StringComparison.Ordinal))
            {
                throw new IdempotencyConflictException(commandId);
            }

            var replay = Deserialize<CombatResult>(previous.ResultJson) with { WasReplay = true };
            await transaction.CommitAsync(cancellationToken);
            return replay;
        }

        var snapshot = await context.CharacterSnapshots
            .SingleOrDefaultAsync(item => item.Id == characterId, cancellationToken)
            ?? throw new CharacterNotFoundException(characterId);
        var current = Deserialize<CharacterState>(snapshot.Json);
        if (current.Version != expectedVersion)
        {
            throw new CombatConflictException(expectedVersion, current.Version);
        }

        var decision = decide(current);
        var sequence = (await context.CombatEvents.MaxAsync(
            item => (long?)item.Sequence,
            cancellationToken) ?? 0) + 1;
        var occurredAt = DateTimeOffset.UtcNow;
        var envelope = new CombatEventEnvelope(
            decision.Event.Id,
            sequence,
            occurredAt,
            commandId,
            characterId,
            decision.Event.Type,
            decision.Event.Summary,
            decision.Event.Details,
            decision.Event.StateAfter);
        var result = new CombatResult(decision.State, envelope, WasReplay: false);

        snapshot.Json = Serialize(decision.State);
        snapshot.Version = decision.State.Version;
        snapshot.UpdatedAt = occurredAt;

        context.CombatEvents.Add(new CombatEventEntity
        {
            Sequence = sequence,
            EventId = envelope.Id,
            CharacterId = characterId,
            CharacterVersion = decision.State.Version,
            Json = Serialize(envelope),
            OccurredAt = occurredAt
        });
        context.ProcessedCommands.Add(new ProcessedCommandEntity
        {
            CharacterId = characterId,
            CommandId = commandId,
            RequestFingerprint = requestFingerprint,
            ResultJson = Serialize(result),
            ProcessedAt = occurredAt
        });

        await context.SaveChangesAsync(cancellationToken);
        await PruneRetentionWindowsAsync(context, characterId, occurredAt, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public Task<CombatResult> ResetAsync(
        string characterId,
        string commandId,
        string requestFingerprint,
        int expectedVersion,
        CancellationToken cancellationToken) =>
        ExecuteAsync(
            characterId,
            commandId,
            requestFingerprint,
            expectedVersion,
            current =>
            {
                var reset = characterSeed.Create(checked(current.Version + 1));
                return new CombatDecision(
                    reset,
                    UncommittedCombatEvent.Create(
                        "EncounterReset",
                        "The encounter was reset to Briv's initial state.",
                        new CombatEventDetails(),
                        reset));
            },
            cancellationToken);

    public static async Task InitializeAsync(
        IDbContextFactory<EncounterDbContext> contextFactory,
        ICharacterSeed characterSeed,
        CancellationToken cancellationToken = default)
    {
        await EncounterDatabaseMigrator.MigrateAsync(contextFactory, cancellationToken);
        await using var context = await contextFactory.CreateDbContextAsync(cancellationToken);
        await context.Database.OpenConnectionAsync(cancellationToken);
        var connection = (SqliteConnection)context.Database.GetDbConnection();
        await using var transaction = connection.BeginTransaction(
            IsolationLevel.Serializable,
            deferred: false);
        await context.Database.UseTransactionAsync(transaction, cancellationToken);

        if (!await context.CharacterSnapshots.AnyAsync(cancellationToken))
        {
            var seed = characterSeed.Create();
            context.CharacterSnapshots.Add(new CharacterSnapshotEntity
            {
                Id = seed.Id,
                Json = Serialize(seed),
                Version = seed.Version,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            await context.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task PruneRetentionWindowsAsync(
        EncounterDbContext context,
        string characterId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var commandCutoff = (now - ProcessedCommandRetention).ToString("O", System.Globalization.CultureInfo.InvariantCulture);
        await context.Database.ExecuteSqlInterpolatedAsync(
            $"""DELETE FROM "ProcessedCommands" WHERE julianday("ProcessedAt") < julianday({commandCutoff});""",
            cancellationToken);

        var oldestRetainedOverflow = await context.CombatEvents
            .Where(item => item.CharacterId == characterId)
            .OrderByDescending(item => item.Sequence)
            .Skip(RetainedEventLimit)
            .Select(item => (long?)item.Sequence)
            .FirstOrDefaultAsync(cancellationToken);
        if (oldestRetainedOverflow is not null)
        {
            await context.CombatEvents
                .Where(item => item.CharacterId == characterId
                    && item.Sequence <= oldestRetainedOverflow.Value)
                .ExecuteDeleteAsync(cancellationToken);
        }
    }

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize(value, JsonDefaults.Options);

    private static T Deserialize<T>(string value) =>
        JsonSerializer.Deserialize<T>(value, JsonDefaults.Options)
        ?? throw new InvalidDataException($"Stored {typeof(T).Name} JSON was invalid.");
}
